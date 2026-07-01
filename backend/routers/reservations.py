from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
import uuid

router = APIRouter(prefix="/api/reservations", tags=["reservations"])
Auth = Depends(auth.get_current_user)

@router.get("", response_model=List[schemas.ReservationOut])
def list_reservations(
    prop_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db), _=Auth
):
    q = db.query(models.Reservation)
    if prop_id: q = q.filter(models.Reservation.prop_id == prop_id)
    if status:  q = q.filter(models.Reservation.status == status)
    return q.order_by(models.Reservation.checkin.desc()).all()

@router.post("", response_model=schemas.ReservationOut, status_code=201)
async def create_reservation(data: schemas.ReservationCreate, db: Session = Depends(get_db), _=Auth):
    if not db.query(models.Property).filter(models.Property.id == data.prop_id).first():
        raise HTTPException(400, "Propriedade inválida")
    if data.checkout <= data.checkin:
        raise HTTPException(400, "Check-out deve ser depois do check-in")
    r = models.Reservation(id=str(uuid.uuid4()), **data.model_dump())
    db.add(r)
    # Auto-create transactions
    if data.price > 0:
        db.add(models.Transaction(
            id=str(uuid.uuid4()), prop_id=data.prop_id, res_id=r.id,
            date=data.checkin, type="income", category="Alojamento",
            amount=data.price, channel=data.channel,
            desc=f"Reserva {data.guest_name}"
        ))
        if data.commission > 0:
            channels = {"airbnb": "Airbnb", "booking": "Booking.com", "livvi": "Livvi", "direct": "Direto"}
            db.add(models.Transaction(
                id=str(uuid.uuid4()), prop_id=data.prop_id, res_id=r.id,
                date=data.checkin, type="expense", category="Comissão OTA",
                amount=data.commission, channel=data.channel,
                desc=f"Comissão {channels.get(data.channel, data.channel)}"
            ))
    # Auto-create cleaning task
    db.add(models.CleaningTask(
        id=str(uuid.uuid4()), prop_id=data.prop_id,
        type="limpeza", date=data.checkout, status="pending",
        priority="high", notes=f"Check-out {data.guest_name}"
    ))
    db.commit(); db.refresh(r)

    # Auto-create Livvi PIN and send confirmation email
    if data.status == "confirmed":
        from .. import livvi_service
        from ..email_service import send_booking_confirmation
        from ..database import SessionLocal
        livvi = await livvi_service.create_booking(
            reservation_id=r.id,
            guest_name=r.guest_name,
            guest_email=r.guest_email or "",
            checkin=r.checkin,
            checkout=r.checkout,
            room=r.room or "",
            settings=settings,
        )
        if livvi:
            r.livvi_booking_id = livvi.get("booking_id", "")
            r.access_pin = livvi.get("pin", "")
            db.commit(); db.refresh(r)
        if r.guest_email:
            rows = db.query(models.Settings).all()
            settings = {row.key: row.value for row in rows}
            prop = db.query(models.Property).filter(models.Property.id == r.prop_id).first()
            send_booking_confirmation(r, prop, settings, access_pin=r.access_pin or "")

    return r

@router.get("/{rid}", response_model=schemas.ReservationOut)
def get_reservation(rid: str, db: Session = Depends(get_db), _=Auth):
    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404, "Reserva não encontrada")
    return r

@router.put("/{rid}", response_model=schemas.ReservationOut)
def update_reservation(rid: str, data: schemas.ReservationUpdate, db: Session = Depends(get_db), _=Auth):
    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404, "Reserva não encontrada")
    for k, v in data.model_dump().items():
        setattr(r, k, v)
    db.commit(); db.refresh(r)
    return r

@router.patch("/{rid}/sef-reported", response_model=schemas.ReservationOut)
def mark_sef_reported(rid: str, db: Session = Depends(get_db), _=Auth):
    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404)
    r.sef_reported = True
    db.commit(); db.refresh(r)
    return r

@router.delete("/{rid}", status_code=204)
def delete_reservation(rid: str, db: Session = Depends(get_db), _=Auth):
    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404)
    db.delete(r); db.commit()

@router.post("/{rid}/send-invoice")
async def send_invoice(rid: str, file: UploadFile = File(...), db: Session = Depends(get_db), _=Auth):
    import smtplib, os
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404, "Reserva não encontrada")
    if not r.guest_email: raise HTTPException(400, "Hóspede sem email registado")

    prop = db.query(models.Property).filter(models.Property.id == r.prop_id).first()
    prop_name = prop.name if prop else "Alojamento"

    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    if not smtp_user or not smtp_pass:
        raise HTTPException(500, "Email não configurado no servidor")

    pdf_bytes = await file.read()
    filename  = file.filename or "fatura.pdf"

    nights = (
        __import__("datetime").date.fromisoformat(r.checkout) -
        __import__("datetime").date.fromisoformat(r.checkin)
    ).days

    html_body = f"""
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px 16px 0 0;padding:32px;text-align:center;color:white">
    <h1 style="margin:0;font-size:24px;font-weight:800">🏠 {prop_name}</h1>
    <p style="margin:8px 0 0;opacity:.85">Fatura da sua estadia</p>
  </div>
  <div style="background:white;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
    <p style="font-size:16px;font-weight:600">Olá {r.guest_name},</p>
    <p style="color:#4b5563;line-height:1.7">
      Segue em anexo a fatura referente à sua estadia em <strong>{prop_name}</strong>
      de <strong>{r.checkin}</strong> a <strong>{r.checkout}</strong> ({nights} noite{"s" if nights!=1 else ""}).
    </p>
    <p style="color:#4b5563;line-height:1.7">
      Agradecemos a sua visita e esperamos tê-lo(a) de volta em breve!
    </p>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px;color:#9ca3af;text-align:center">
      {prop_name} · Enviado via AL Manager
    </div>
  </div>
</div>"""

    try:
        msg = MIMEMultipart("mixed")
        msg["Subject"] = f"Fatura — {prop_name} | {r.checkin} a {r.checkout}"
        msg["From"]    = f"{prop_name} <{smtp_user}>"
        msg["To"]      = r.guest_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        part = MIMEBase("application", "octet-stream")
        part.set_payload(pdf_bytes)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
        msg.attach(part)
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
            s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_user, r.guest_email, msg.as_string())
    except Exception as e:
        raise HTTPException(500, f"Erro ao enviar email: {e}")

    return {"ok": True, "sent_to": r.guest_email}
