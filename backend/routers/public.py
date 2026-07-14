import logging
import os
import uuid
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..booking_logic import check_overlap
from ..database import get_db
from .. import stripe_service

router = APIRouter(prefix="/api/public", tags=["public"])
_log = logging.getLogger(__name__)

# The public marketing site (casadapenha.pt), NOT this API's own URL — Stripe redirects
# the guest's browser back here after checkout, so it must point at the booking pages.
PUBLIC_SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://casadapenha.pt").rstrip("/")


@router.get("/rooms", response_model=list[schemas.PublicRoomOut])
def list_public_rooms(db: Session = Depends(get_db)):
    return db.query(models.Property).filter(models.Property.public_bookable == True).all()  # noqa: E712


@router.get("/availability")
def get_availability(
    prop_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Return booked date ranges for a public room. Never exposes guest names or other PII."""
    prop = db.query(models.Property).filter(
        models.Property.id == prop_id, models.Property.public_bookable == True  # noqa: E712
    ).first()
    if not prop:
        raise HTTPException(404, "Quarto não encontrado")

    rows = db.query(models.Reservation).filter(
        models.Reservation.prop_id == prop_id,
        models.Reservation.status != "cancelled",
    ).all()
    return [{"checkin": r.checkin, "checkout": r.checkout} for r in rows]


@router.post("/booking-requests")
def create_booking_request(
    data: schemas.PublicBookingRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    # Honeypot: bots fill every field, including this hidden one. Pretend success, do nothing.
    if data.hp:
        _log.info(f"Booking request honeypot triggered from {request.client.host if request.client else '?'}")
        return {"checkout_url": None, "ok": True}

    prop = db.query(models.Property).filter(
        models.Property.id == data.prop_id, models.Property.public_bookable == True  # noqa: E712
    ).first()
    if not prop:
        raise HTTPException(400, "Quarto inválido")

    if data.checkout <= data.checkin:
        raise HTTPException(400, "Check-out deve ser depois do check-in")
    if data.checkin < date.today().isoformat():
        raise HTTPException(400, "Check-in não pode ser no passado")

    try:
        check_overlap(db, data.prop_id, data.checkin, data.checkout)
    except HTTPException:
        # check_overlap's message names the existing guest — fine for the authenticated
        # CRM UI, but never expose that to an anonymous public caller.
        raise HTTPException(409, "Este quarto já está reservado para essas datas. Escolha outro período.")

    nights = (date.fromisoformat(data.checkout) - date.fromisoformat(data.checkin)).days
    price = round(nights * (prop.nightly_rate or 0), 2)
    if price <= 0:
        raise HTTPException(400, "Este quarto não tem tarifa configurada — contacte-nos diretamente")

    r = models.Reservation(
        id=str(uuid.uuid4()),
        prop_id=data.prop_id,
        guest_name=data.guest_name,
        guest_email=data.guest_email,
        guest_phone=data.guest_phone,
        guests=data.guests,
        checkin=data.checkin,
        checkout=data.checkout,
        channel="website",
        status="pending",
        price=price,
        deposit_status="awaiting_payment",
        notes=data.notes,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    success_url = f"{PUBLIC_SITE_URL}/reserva-confirmada.html?rid={r.id}"
    cancel_url = f"{PUBLIC_SITE_URL}/reserva-cancelada.html?rid={r.id}"
    session = stripe_service.create_checkout_session(r, prop, success_url, cancel_url)

    if not session:
        db.delete(r)
        db.commit()
        raise HTTPException(502, "Não foi possível iniciar o pagamento. Tente novamente em instantes.")

    r.stripe_session_id = session["id"]
    db.commit()

    return {"checkout_url": session["url"], "ok": True}


@router.post("/stripe-webhook", include_in_schema=False)
async def stripe_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.verify_webhook(payload, sig_header)
    except Exception as e:
        _log.warning(f"Stripe webhook: assinatura inválida ({e})")
        raise HTTPException(400, "Assinatura inválida")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        reservation_id = (session.get("metadata") or {}).get("reservation_id")
        if reservation_id:
            r = db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()
            if r and r.deposit_status != "paid":
                r.deposit_status = "paid"
                db.commit()
                background_tasks.add_task(_notify_paid_booking_request, reservation_id)
                _log.info(f"Pagamento confirmado via Stripe para reserva {reservation_id}")

    return {"ok": True}


def _notify_paid_booking_request(reservation_id: str):
    from ..email_service import send_new_booking_request_notification, send_booking_request_received
    from ..database import SessionLocal

    db = SessionLocal()
    try:
        r = db.query(models.Reservation).filter(models.Reservation.id == reservation_id).first()
        if not r:
            return
        prop = db.query(models.Property).filter(models.Property.id == r.prop_id).first()
        rows = db.query(models.Settings).all()
        settings = {row.key: row.value for row in rows}
        send_new_booking_request_notification(r, prop, settings)
        send_booking_request_received(r, prop)
    except Exception as e:
        _log.error(f"Erro ao notificar pedido de reserva pago {reservation_id}: {e}", exc_info=True)
    finally:
        db.close()
