import logging
import os
import uuid
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from .. import models, schemas
from ..booking_logic import check_overlap
from ..database import get_db

router = APIRouter(prefix="/api/public", tags=["public"])
_log = logging.getLogger(__name__)


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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Honeypot: bots fill every field, including this hidden one.
    if data.hp:
        _log.info(f"Booking request honeypot triggered from {request.client.host if request.client else '?'}")
        return {"ok": True}

    prop = db.query(models.Property).filter(
        models.Property.id == data.prop_id, models.Property.public_bookable == True  # noqa: E712
    ).first()
    if not prop:
        raise HTTPException(400, "Quarto inválido")

    if data.checkout <= data.checkin:
        raise HTTPException(400, "Check-out deve ser depois do check-in")
    if data.checkin < date.today().isoformat():
        raise HTTPException(400, "Check-in não pode ser no passado")

    min_nights = getattr(prop, "min_nights", 1) or 1
    nights = (date.fromisoformat(data.checkout) - date.fromisoformat(data.checkin)).days
    if nights < min_nights:
        raise HTTPException(400, f"Estadia mínima de {min_nights} noite{'s' if min_nights != 1 else ''}")

    try:
        check_overlap(db, data.prop_id, data.checkin, data.checkout)
    except HTTPException:
        raise HTTPException(409, "Este quarto já está reservado para essas datas. Escolha outro período.")

    price = round(nights * (prop.nightly_rate or 0), 2)

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
        deposit_status="not_required",
        notes=data.notes,
    )
    db.add(r)
    db.commit()
    db.refresh(r)

    background_tasks.add_task(_notify_new_booking_request, r.id)
    _log.info(f"Pedido de reserva criado: {r.id} ({r.guest_name}, {r.checkin}→{r.checkout})")

    return {"ok": True, "reservation_id": r.id}


def _notify_new_booking_request(reservation_id: str):
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
        _log.error(f"Erro ao notificar pedido de reserva {reservation_id}: {e}", exc_info=True)
    finally:
        db.close()
