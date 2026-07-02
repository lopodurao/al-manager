from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from .. import models, schemas, auth
from ..database import get_db, SessionLocal
import httpx, uuid, re, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ota", tags=["ota"])
Auth = Depends(auth.get_current_user)


@router.get("", response_model=List[schemas.OtaChannelOut])
def list_channels(db: Session = Depends(get_db), _=Auth):
    return db.query(models.OtaChannel).all()


@router.put("/{cid}", response_model=schemas.OtaChannelOut)
def update_channel(cid: str, data: schemas.OtaChannelUpdate, db: Session = Depends(get_db), _=Auth):
    ch = db.query(models.OtaChannel).filter(models.OtaChannel.id == cid).first()
    if not ch: raise HTTPException(404)
    ch.ical_url = data.ical_url
    ch.active   = data.active
    db.commit(); db.refresh(ch)
    return ch


def _get_settings(db: Session) -> dict:
    rows = db.query(models.Settings).all()
    return {r.key: r.value for r in rows}


def _parse_ical(text: str, prop_id: str, channel: str, db: Session) -> list:
    """Parse iCal and return list of newly created Reservation objects."""
    events = text.split("BEGIN:VEVENT")[1:]
    new_reservations = []
    for ev in events:
        def get(key):
            m = re.search(rf"{key}[^:]*:([^\r\n]+)", ev)
            return m.group(1).strip() if m else ""
        dtstart = get("DTSTART").replace("T", "").replace("Z", "")[:8]
        dtend   = get("DTEND").replace("T",   "").replace("Z", "")[:8]
        summary = get("SUMMARY")
        uid     = get("UID")
        desc    = get("DESCRIPTION")
        if len(dtstart) < 8 or len(dtend) < 8:
            continue
        checkin  = f"{dtstart[:4]}-{dtstart[4:6]}-{dtstart[6:8]}"
        checkout = f"{dtend[:4]}-{dtend[4:6]}-{dtend[6:8]}"
        if db.query(models.Reservation).filter(models.Reservation.ical_uid == uid).first():
            continue
        # Skip if this would overlap with an existing non-cancelled reservation
        conflict = db.query(models.Reservation).filter(
            models.Reservation.prop_id == prop_id,
            models.Reservation.status != "cancelled",
            models.Reservation.checkin < checkout,
            models.Reservation.checkout > checkin,
        ).first()
        if conflict:
            logger.warning(f"iCal: ignorada sobreposição {checkin}→{checkout} (uid={uid}) com {conflict.guest_name} {conflict.checkin}→{conflict.checkout}")
            continue
        # Extract email from DESCRIPTION if present
        email = ""
        email_match = re.search(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", desc or "")
        if email_match:
            email = email_match.group(0)
        res = models.Reservation(
            id=str(uuid.uuid4()), prop_id=prop_id,
            guest_name=summary or "Reserva importada",
            guest_email=email,
            checkin=checkin, checkout=checkout,
            channel=channel, status="confirmed",
            ical_uid=uid, notes="Importado via iCal"
        )
        db.add(res)
        new_reservations.append(res)
    db.commit()
    return new_reservations


async def _livvi_and_email(new_reservations: list, db: Session):
    """Create Livvi bookings (PIN) and send confirmation emails for new reservations."""
    from ..email_service import send_booking_confirmation
    from .. import livvi_service
    settings = _get_settings(db)
    for res in new_reservations:
        # Create Livvi booking for PIN code
        prop = db.query(models.Property).filter(models.Property.id == res.prop_id).first()
        door_ids = [d.strip() for d in (prop.livvi_door_ids or "").split(",") if d.strip()] if prop else []
        livvi = await livvi_service.create_booking(
            reservation_id=res.id,
            guest_name=res.guest_name,
            guest_email=res.guest_email or "",
            checkin=res.checkin,
            checkout=res.checkout,
            door_ids=door_ids or None,
        )
        pin = ""
        if livvi:
            res.livvi_booking_id = livvi.get("booking_id", "")
            res.access_pin = livvi.get("pin", "")
            pin = res.access_pin
            db.commit()
            logger.info(f"Livvi PIN={pin} para {res.guest_name}")

        if not res.guest_email:
            logger.info(f"Reserva {res.id} sem email — confirmação não enviada")
            continue
        prop_obj = db.query(models.Property).filter(models.Property.id == res.prop_id).first()
        ok = send_booking_confirmation(res, prop_obj, settings, access_pin=pin)
        if ok:
            logger.info(f"Confirmação enviada para {res.guest_email} ({res.guest_name})")


@router.post("/{cid}/sync")
async def sync_channel(cid: str, prop_id: str, db: Session = Depends(get_db), _=Auth):
    ch = db.query(models.OtaChannel).filter(models.OtaChannel.id == cid).first()
    if not ch or not ch.ical_url:
        raise HTTPException(400, "Canal sem URL iCal configurado")
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        try:
            resp = await client.get(ch.ical_url)
            resp.raise_for_status()
        except Exception as e:
            raise HTTPException(502, f"Erro ao obter calendário: {e}")
    new_res = _parse_ical(resp.text, prop_id, ch.slug, db)
    await _livvi_and_email(new_res, db)
    ch.last_sync = str(date.today())
    db.commit()
    return {"imported": len(new_res)}


@router.post("/import-ical")
async def import_ical_url(prop_id: str, channel: str, url: str, db: Session = Depends(get_db), _=Auth):
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except Exception as e:
            raise HTTPException(502, f"Erro ao obter calendário: {e}")
    new_res = _parse_ical(resp.text, prop_id, channel, db)
    await _livvi_and_email(new_res, db)
    return {"imported": len(new_res)}


@router.get("/export-ical")
def export_ical(prop_id: str = None, db: Session = Depends(get_db), _=Auth):
    """Authenticated export — used internally by the download button."""
    return _build_ical_response(prop_id, db)


@router.get("/calendar/{token}")
def export_ical_public(token: str, prop_id: str = None, db: Session = Depends(get_db)):
    """Public iCal feed — no auth, protected by secret token. Give this URL to Airbnb/Booking."""
    row = db.query(models.Settings).filter(models.Settings.key == "icalToken").first()
    if not row or row.value != token:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse("Token inválido", status_code=403)
    return _build_ical_response(prop_id, db)


def _build_ical_response(prop_id, db):
    from fastapi.responses import PlainTextResponse
    q = db.query(models.Reservation).filter(models.Reservation.status != "cancelled")
    if prop_id:
        q = q.filter(models.Reservation.prop_id == prop_id)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AL Manager//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]
    for r in q.all():
        prop = db.query(models.Property).filter(models.Property.id == r.prop_id).first()
        ci = r.checkin.replace("-", "")
        co = r.checkout.replace("-", "")
        lines += [
            "BEGIN:VEVENT",
            f"UID:{r.id}@al-manager",
            f"DTSTART;VALUE=DATE:{ci}",
            f"DTEND;VALUE=DATE:{co}",
            f"SUMMARY:{r.guest_name}",
            f"DESCRIPTION:{r.guest_name} | {r.channel} | {prop.name if prop else ''}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return PlainTextResponse("\r\n".join(lines), media_type="text/calendar; charset=utf-8")


async def auto_sync_all():
    """Scheduled job: sync all active OTA channels for all properties."""
    db = SessionLocal()
    try:
        channels = db.query(models.OtaChannel).filter(
            models.OtaChannel.active == True,
            models.OtaChannel.ical_url != ""
        ).all()
        properties = db.query(models.Property).all()
        if not channels or not properties:
            return
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
            for ch in channels:
                for prop in properties:
                    try:
                        resp = await client.get(ch.ical_url)
                        resp.raise_for_status()
                        new_res = _parse_ical(resp.text, prop.id, ch.slug, db)
                        if new_res:
                            await _livvi_and_email(new_res, db)
                            logger.info(f"Auto-sync {ch.name}/{prop.name}: {len(new_res)} novas reservas")
                        ch.last_sync = str(date.today())
                        db.commit()
                    except Exception as e:
                        logger.error(f"Auto-sync erro {ch.name}: {e}")
    finally:
        db.close()
