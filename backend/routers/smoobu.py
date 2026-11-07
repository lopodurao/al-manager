"""Smoobu integration — webhook receiver + periodic sync."""
from fastapi import APIRouter, Request, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from .. import models
from ..booking_logic import check_overlap as _check_overlap
import os, uuid, hmac, hashlib, base64, logging, httpx
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/smoobu", tags=["smoobu"])

SMOOBU_API_KEY    = os.getenv("SMOOBU_API_KEY", "")
SMOOBU_API_SECRET = os.getenv("SMOOBU_API_SECRET", "")
SMOOBU_BASE       = "https://login.smoobu.com"

# Smoobu apartment ID → AL Manager property ID
# Set via env var SMOOBU_PROP_MAP as "smoobu_id:prop_id,smoobu_id:prop_id"
# e.g. "3584721:4eebf8e1-f54e-4716-b718-e0d7b3d26bdf,3584720:06db7f96-1d42-454c-8afb-66f0f591347f"
def _prop_map() -> dict:
    raw = os.getenv("SMOOBU_PROP_MAP", "")
    result = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if ":" in pair:
            sid, pid = pair.split(":", 1)
            result[sid.strip()] = pid.strip()
    return result

# Smoobu "whole property" apartment IDs → list of prop_ids to book together
# Set via env var SMOOBU_WHOLE_PROP as "smoobu_id:prop_id1+prop_id2"
def _whole_prop_map() -> dict:
    raw = os.getenv("SMOOBU_WHOLE_PROP", "")
    result = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if ":" in pair:
            sid, pids = pair.split(":", 1)
            result[sid.strip()] = [p.strip() for p in pids.split("+") if p.strip()]
    return result


def _smoobu_headers(method: str, path: str, query: str = "", body: bytes = b"") -> dict:
    if not SMOOBU_API_KEY or not SMOOBU_API_SECRET:
        return {}
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    nonce = str(uuid.uuid4())
    body_hash = hashlib.sha256(body).hexdigest()
    canonical = "\n".join([method.upper(), path, query, ts, nonce, body_hash, SMOOBU_API_KEY])
    sig = base64.b64encode(
        hmac.new(SMOOBU_API_SECRET.encode(), canonical.encode(), hashlib.sha256).digest()
    ).decode()
    return {"X-API-Key": SMOOBU_API_KEY, "X-Timestamp": ts, "X-Nonce": nonce, "X-Signature": sig}


async def _smoobu_get(path: str, params: dict = None) -> dict:
    import urllib.parse
    query = urllib.parse.urlencode(sorted((params or {}).items()))
    headers = _smoobu_headers("GET", path, query)
    url = SMOOBU_BASE + path + ("?" + query if query else "")
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(url, headers=headers)
        r.raise_for_status()
        return r.json()


def _upsert_reservation(db: Session, booking: dict, prop_id: str, extra_prop_ids: str = "") -> bool:
    """Create or update a reservation from a Smoobu booking dict. Returns True if created/updated."""
    smoobu_id = str(booking.get("id", ""))
    if not smoobu_id or not prop_id:
        return False

    checkin  = booking.get("arrival", "")
    checkout = booking.get("departure", "")
    if not checkin or not checkout:
        return False

    # Map Smoobu status — type is a string "reservation"/"cancelled"/etc.
    smoobu_type = booking.get("type") or ""
    if isinstance(smoobu_type, dict):
        smoobu_type = smoobu_type.get("name", "")
    if smoobu_type in ("cancelled", "declined") or booking.get("is-blocked-booking"):
        status = "cancelled"
    else:
        status = "confirmed"

    # Smoobu uses hyphenated field names
    firstname  = booking.get("firstname", "") or ""
    lastname   = booking.get("lastname", "") or ""
    guest_name = booking.get("guest-name") or booking.get("guestName") or ""
    if not guest_name:
        guest_name = f"{firstname} {lastname}".strip() or "Smoobu Guest"
    email      = booking.get("email", "") or ""
    phone      = booking.get("phone", "") or ""
    adults     = int(booking.get("adults") or 1)
    children   = int(booking.get("children") or 0)
    guests_n   = adults + children
    price      = float(booking.get("price") or 0)
    ch_name    = (booking.get("channel") or {}).get("name", "smoobu").lower()
    channel_map = {"airbnb": "airbnb", "booking.com": "booking", "smoobu direct": "direct",
                   "direct booking": "direct"}
    channel = channel_map.get(ch_name, "smoobu")

    # Look up existing by smoobu ID stored in ical_uid
    existing = db.query(models.Reservation).filter(
        models.Reservation.ical_uid == f"smoobu-{smoobu_id}"
    ).first()

    if existing:
        if status == "cancelled" and existing.status != "cancelled":
            existing.status = "cancelled"
            db.commit()
            logger.info(f"Smoobu reserva {smoobu_id} cancelada")
            return existing.livvi_booking_id or True  # return livvi_id so caller can delete it
        # Check if dates changed — if so, may need to recreate Livvi PIN
        dates_changed = (existing.checkin != checkin or existing.checkout != checkout)
        if not dates_changed:
            existing.price = price
            existing.extra_prop_ids = extra_prop_ids
            db.commit()
            return False

        from datetime import date as _date
        today_str = _date.today().isoformat()
        active_stay = (existing.checkin <= today_str < existing.checkout)
        checkout_shortened = checkout < existing.checkout  # security risk — must recreate

        old_livvi_id = existing.livvi_booking_id
        old_checkout = existing.checkout
        existing.checkin  = checkin
        existing.checkout = checkout
        existing.price    = price
        existing.extra_prop_ids = extra_prop_ids

        if active_stay and not checkout_shortened:
            # Guest is in-house and checkout extended — keep old PIN, create extra booking
            db.commit()
            return ("extend", old_livvi_id, existing.id)
        else:
            # Checkout shortened OR not yet checked in — delete old PIN and recreate
            existing.livvi_booking_id = ""
            existing.access_pin = ""
            db.commit()
            return ("update", old_livvi_id, existing.id)
    else:
        if status == "cancelled":
            return False  # cancelled before we ever stored it

        # Overlap check
        try:
            _check_overlap(db, prop_id, checkin, checkout)
            for eid in [p for p in extra_prop_ids.split(",") if p.strip()]:
                _check_overlap(db, eid, checkin, checkout)
        except HTTPException:
            logger.warning(f"Smoobu reserva {smoobu_id} ignorada — sobreposição de datas")
            return False

        r = models.Reservation(
            id=str(uuid.uuid4()), prop_id=prop_id,
            guest_name=guest, guest_email=email, guest_phone=phone,
            guests=guests_n, checkin=checkin, checkout=checkout,
            channel=channel, status=status,
            price=price, commission=0,
            ical_uid=f"smoobu-{smoobu_id}",
            extra_prop_ids=extra_prop_ids,
            notes=f"Importado via Smoobu (booking #{smoobu_id})"
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        logger.info(f"Smoobu reserva {smoobu_id} criada → {r.id}")
        return True


@router.post("/webhook")
async def smoobu_webhook(request: Request, background_tasks: BackgroundTasks):
    """Receive Smoobu booking events (new / updated / cancelled)."""
    payload = await request.json()
    logger.info(f"Smoobu webhook payload: {payload}")

    action  = payload.get("action", "")   # "booking", "cancellation", etc.

    # Ignore non-reservation events (rate updates, messages, etc.)
    reservation_actions = {"newReservation", "updateReservation", "cancelReservation",
                           "booking", "cancellation", "modification"}
    if action and action not in reservation_actions:
        logger.info(f"Smoobu webhook: ignorado evento '{action}'")
        return {"ok": True, "skipped": True}

    booking = payload.get("booking") or payload.get("data") or payload

    smoobu_apt_id = str((booking.get("apartment") or {}).get("id") or booking.get("apartmentId") or "")
    prop_map       = _prop_map()
    whole_map      = _whole_prop_map()

    # Whole-property booking (e.g. "Apartamento")
    if smoobu_apt_id in whole_map:
        prop_ids   = whole_map[smoobu_apt_id]
        prop_id    = prop_ids[0]
        extra_ids  = ",".join(prop_ids[1:])
    elif smoobu_apt_id in prop_map:
        prop_id   = prop_map[smoobu_apt_id]
        extra_ids = ""
    else:
        logger.warning(f"Smoobu webhook: apartamento {smoobu_apt_id} não mapeado — configura SMOOBU_PROP_MAP")
        return {"ok": True, "skipped": True}

    db = SessionLocal()
    try:
        result = _upsert_reservation(db, booking, prop_id, extra_ids)
        if result:
            from .reservations import _livvi_and_email_bg
            from .. import livvi_service

            if isinstance(result, tuple) and result[0] == "update":
                # Dates changed (or checkout shortened) → delete old PIN, create new
                _, old_livvi_id, res_id = result
                if old_livvi_id:
                    background_tasks.add_task(livvi_service.delete_booking, old_livvi_id)
                background_tasks.add_task(_livvi_and_email_bg, res_id)
            elif isinstance(result, tuple) and result[0] == "extend":
                # Guest in-house, checkout extended → keep old PIN, just notify new dates
                _, _old_livvi_id, res_id = result
                background_tasks.add_task(_livvi_and_email_bg, res_id)
            elif isinstance(result, str) and result:
                # Cancelled → delete Livvi PIN
                background_tasks.add_task(livvi_service.delete_booking, result)
            elif result is True:
                # New confirmed reservation → PIN + email
                res = db.query(models.Reservation).filter(
                    models.Reservation.ical_uid == f"smoobu-{booking.get('id')}"
                ).first()
                if res and res.status == "confirmed":
                    background_tasks.add_task(_livvi_and_email_bg, res.id)
    finally:
        db.close()

    return {"ok": True}


async def sync_smoobu():
    """Pull recent bookings from Smoobu API — called by scheduler every hour."""
    if not SMOOBU_API_KEY:
        return
    prop_map  = _prop_map()
    whole_map = _whole_prop_map()
    if not prop_map and not whole_map:
        logger.warning("Smoobu sync: SMOOBU_PROP_MAP não configurado")
        return
    try:
        from datetime import date, timedelta
        today = date.today().isoformat()
        future = (date.today() + timedelta(days=180)).isoformat()
        data = await _smoobu_get("/api/reservations", {"from": today, "to": future, "pageSize": "100", "showCancellation": "true"})
        bookings = data.get("bookings", [])
        db = SessionLocal()
        try:
            created_count = 0
            for booking in bookings:
                smoobu_apt_id = str((booking.get("apartment") or {}).get("id", ""))
                if smoobu_apt_id in whole_map:
                    prop_ids  = whole_map[smoobu_apt_id]
                    prop_id   = prop_ids[0]
                    extra_ids = ",".join(prop_ids[1:])
                elif smoobu_apt_id in prop_map:
                    prop_id   = prop_map[smoobu_apt_id]
                    extra_ids = ""
                else:
                    continue
                if _upsert_reservation(db, booking, prop_id, extra_ids):
                    created_count += 1
            if created_count:
                logger.info(f"Smoobu sync: {created_count} reservas novas importadas")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Smoobu sync erro: {e}", exc_info=True)
