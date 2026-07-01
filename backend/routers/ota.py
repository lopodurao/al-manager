from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from .. import models, schemas, auth
from ..database import get_db
import httpx, uuid, re

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
    ch.active = data.active
    db.commit(); db.refresh(ch)
    return ch

def _parse_ical(text: str, prop_id: str, channel: str, db: Session) -> int:
    events = text.split("BEGIN:VEVENT")[1:]
    imported = 0
    for ev in events:
        def get(key):
            m = re.search(rf"{key}[^:]*:([^\r\n]+)", ev)
            return m.group(1).strip() if m else ""
        dtstart = get("DTSTART").replace("T", "").replace("Z", "")[:8]
        dtend   = get("DTEND").replace("T", "").replace("Z", "")[:8]
        summary = get("SUMMARY")
        uid     = get("UID")
        if len(dtstart) < 8 or len(dtend) < 8:
            continue
        checkin  = f"{dtstart[:4]}-{dtstart[4:6]}-{dtstart[6:8]}"
        checkout = f"{dtend[:4]}-{dtend[4:6]}-{dtend[6:8]}"
        if db.query(models.Reservation).filter(models.Reservation.ical_uid == uid).first():
            continue
        db.add(models.Reservation(
            id=str(uuid.uuid4()), prop_id=prop_id,
            guest_name=summary or "Reserva importada",
            checkin=checkin, checkout=checkout,
            channel=channel, status="confirmed",
            ical_uid=uid, notes="Importado via iCal"
        ))
        imported += 1
    db.commit()
    return imported

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
    n = _parse_ical(resp.text, prop_id, ch.slug, db)
    ch.last_sync = str(date.today())
    db.commit()
    return {"imported": n}

@router.post("/import-ical")
async def import_ical_url(prop_id: str, channel: str, url: str, db: Session = Depends(get_db), _=Auth):
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except Exception as e:
            raise HTTPException(502, f"Erro ao obter calendário: {e}")
    n = _parse_ical(resp.text, prop_id, channel, db)
    return {"imported": n}

@router.get("/export-ical")
def export_ical(prop_id: str = None, db: Session = Depends(get_db), _=Auth):
    from fastapi.responses import PlainTextResponse
    q = db.query(models.Reservation).filter(models.Reservation.status != "cancelled")
    if prop_id:
        q = q.filter(models.Reservation.prop_id == prop_id)
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AL Manager//PT", "CALSCALE:GREGORIAN"]
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
    return PlainTextResponse("\r\n".join(lines), media_type="text/calendar")
