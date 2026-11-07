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

    # Map Smoobu status
    smoobu_status = booking.get("type", {}).get("name", "") if isinstance(booking.get("type"), dict) else booking.get("type", "")
    if smoobu_status in ("cancelled", "declined"):
        status = "cancelled"
    else:
        status = "confirmed"

    guest      = booking.get("guestName", booking.get("guest-name", "")) or "Smoobu Guest"
    email      = booking.get("email", "") or ""
    phone      = booking.get("phone", "") or ""
    guests_n   = int(booking.get("adults", 1) or 1) + int(booking.get("children", 0) or 0)
    price      = float(booking.get("price", 0) or 0)
    channel    = (booking.get("channel", {}) or {}).get("name", "smoobu").lower().replace(" ", "_") if isinstance(booking.get("channel"), dict) else "smoobu"
    # Normalise channel slug
    channel_map = {"airbnb": "airbnb", "booking.com": "booking", "smoobu direct": "direct"}
    channel = channel_map.get(channel, "smoobu")

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
        # Update fields that may change
        existing.checkin  = checkin
        existing.checkout = checkout
        existing.price    = price
        existing.extra_prop_ids = extra_prop_ids
        db.commit()
        return False  # no need to trigger Livvi again
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
    logger.info(f"Smoobu webhook: {payload}")

    action  = payload.get("action", "")   # "booking", "cancellation", etc.
    booking = payload.get("booking") or payload.get("data") or payload

    smoobu_apt_id = str(booking.get("apartmentId") or (booking.get("apartment") or {}).get("id", ""))
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
            res = db.query(models.Reservation).filter(
                models.Reservation.ical_uid == f"smoobu-{booking.get('id')}"
            ).first()
            if res and res.status == "confirmed":
                # New confirmed reservation → Livvi PIN + email
                from .reservations import _livvi_and_email_bg
                background_tasks.add_task(_livvi_and_email_bg, res.id)
            elif isinstance(result, str) and result:
                # Cancelled reservation → delete Livvi PIN
                from .. import livvi_service
                background_tasks.add_task(livvi_service.delete_booking, result)
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
        data = await _smoobu_get("/api/reservations", {"from": today, "to": future, "pageSize": "100"})
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
