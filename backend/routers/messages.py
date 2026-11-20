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
def trigger_messages_now(_=Auth):
    from ..main import _send_scheduled_messages
    _send_scheduled_messages()
    return {"ok": True}

@router.post("/send-test", status_code=200)
def send_test(data: dict, db: Session = Depends(get_db), _=Auth):
    """Force-send a template to a reservation, ignoring time window."""
    from .. import models
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
