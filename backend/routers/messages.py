from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db
import uuid

router = APIRouter(prefix="/api/messages", tags=["messages"])
Auth = Depends(auth.get_current_user)

@router.get("", response_model=List[schemas.MessageTemplateOut])
def list_messages(db: Session = Depends(get_db), _=Auth):
    return db.query(models.MessageTemplate).order_by(models.MessageTemplate.name).all()

@router.post("", response_model=schemas.MessageTemplateOut, status_code=201)
def create_message(data: schemas.MessageTemplateCreate, db: Session = Depends(get_db), _=Auth):
    m = models.MessageTemplate(id=str(uuid.uuid4()), **data.model_dump())
    db.add(m); db.commit(); db.refresh(m)
    return m

@router.put("/{mid}", response_model=schemas.MessageTemplateOut)
def update_message(mid: str, data: schemas.MessageTemplateCreate, db: Session = Depends(get_db), _=Auth):
    m = db.query(models.MessageTemplate).filter(models.MessageTemplate.id == mid).first()
    if not m: raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return m

@router.patch("/{mid}/toggle", response_model=schemas.MessageTemplateOut)
def toggle_message(mid: str, db: Session = Depends(get_db), _=Auth):
    m = db.query(models.MessageTemplate).filter(models.MessageTemplate.id == mid).first()
    if not m: raise HTTPException(404)
    m.active = not m.active
    db.commit(); db.refresh(m)
    return m

@router.delete("/{mid}", status_code=204)
def delete_message(mid: str, db: Session = Depends(get_db), _=Auth):
    m = db.query(models.MessageTemplate).filter(models.MessageTemplate.id == mid).first()
    if not m: raise HTTPException(404)
    db.delete(m); db.commit()

@router.post("/trigger-now", status_code=200)
def trigger_messages_now(db: Session = Depends(get_db), _=Auth):
    from datetime import datetime, timezone, timedelta
    from .. import models
    from ..email_service import _send
    import uuid as _uuid
    now = datetime.now(timezone.utc)
    templates = db.query(models.MessageTemplate).filter(models.MessageTemplate.active == True).all()
    reservations = db.query(models.Reservation).filter(
        models.Reservation.status == "confirmed",
        models.Reservation.guest_email != "",
        models.Reservation.guest_email != None,
    ).all()
    s = {r.key: r.value for r in db.query(models.Settings).all()}
    sent_count = 0
    for tpl in templates:
        for res in reservations:
            already = db.query(models.MessageSent).filter(
                models.MessageSent.template_id == tpl.id,
                models.MessageSent.reservation_id == res.id,
            ).first()
            if already:
                continue
            checkin = res.checkin; checkout = res.checkout
            target_dt = None
            if tpl.trigger == "checkin-1d":
                target_dt = datetime.fromisoformat(checkin).replace(tzinfo=timezone.utc) - timedelta(days=1)
            elif tpl.trigger == "checkin-2h":
                h = int((s.get("checkinTime","16:00") or "16:00").split(":")[0])
                target_dt = datetime.fromisoformat(checkin).replace(hour=h, tzinfo=timezone.utc) - timedelta(hours=2)
            elif tpl.trigger == "checkin-0d":
                h = int((s.get("checkinTime","16:00") or "16:00").split(":")[0])
                target_dt = datetime.fromisoformat(checkin).replace(hour=h, tzinfo=timezone.utc)
            elif tpl.trigger == "checkout-1d":
                target_dt = datetime.fromisoformat(checkout).replace(tzinfo=timezone.utc) - timedelta(days=1)
            elif tpl.trigger == "checkout+1d":
                target_dt = datetime.fromisoformat(checkout).replace(tzinfo=timezone.utc) + timedelta(days=1)
            if target_dt is None:
                continue
            if not (now - timedelta(minutes=30) <= target_dt <= now):
                continue
            prop = db.query(models.Property).filter(models.Property.id == res.prop_id).first()
            body = (tpl.body or "").replace("{{guest}}", res.guest_name or "").replace("{{property}}", prop.name if prop else "").replace("{{checkin_date}}", res.checkin or "").replace("{{checkout_date}}", res.checkout or "").replace("{{checkin_time}}", s.get("checkinTime","16:00")).replace("{{checkout_time}}", s.get("checkoutTime","11:00")).replace("{{access_code}}", res.access_pin or s.get("accessCode","")).replace("{{key_location}}", s.get("keyLocation",""))
            subject = (tpl.subject or "").replace("{{property}}", prop.name if prop else "").replace("{{guest}}", res.guest_name or "")
            if _send(res.guest_email, subject, f"<pre style='font-family:inherit;white-space:pre-wrap'>{body}</pre>"):
                db.add(models.MessageSent(id=str(_uuid.uuid4()), template_id=tpl.id, reservation_id=res.id))
                db.commit()
                sent_count += 1
    return {"ok": True, "sent": sent_count}

@router.post("/send-test", status_code=200)
def send_test(data: dict, db: Session = Depends(get_db), _=Auth):
    from ..email_service import _send
    import uuid as _uuid
    tpl = db.query(models.MessageTemplate).filter(models.MessageTemplate.id == data["template_id"]).first()
    res = db.query(models.Reservation).filter(models.Reservation.id == data["reservation_id"]).first()
    if not tpl or not res: raise HTTPException(404)
    to_email = data.get("override_email") or res.guest_email
    prop = db.query(models.Property).filter(models.Property.id == res.prop_id).first()
    s = {r.key: r.value for r in db.query(models.Settings).all()}
    body = (tpl.body or "") \
        .replace("{{guest}}", res.guest_name or "") \
        .replace("{{property}}", prop.name if prop else "") \
        .replace("{{checkin_date}}", res.checkin or "") \
        .replace("{{checkout_date}}", res.checkout or "") \
        .replace("{{checkin_time}}", s.get("checkinTime", "16:00")) \
        .replace("{{checkout_time}}", s.get("checkoutTime", "11:00")) \
        .replace("{{access_code}}", res.access_pin or s.get("accessCode", "")) \
        .replace("{{key_location}}", s.get("keyLocation", ""))
    subject = (tpl.subject or "") \
        .replace("{{property}}", prop.name if prop else "") \
        .replace("{{guest}}", res.guest_name or "")
    sent = _send(to_email, subject, f"<pre style='font-family:inherit;white-space:pre-wrap'>{body}</pre>")
    return {"ok": sent, "to": to_email, "subject": subject}
