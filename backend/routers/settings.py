from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth
from ..database import get_db
import json, os

router = APIRouter(prefix="/api/settings", tags=["settings"])
Auth = Depends(auth.get_current_user)

DEFAULT_SETTINGS = {
    "ownerName": "", "ownerNIF": "", "ownerPhone": "", "ownerEmail": "",
    "alLicense": "", "checkinTime": "15:00", "checkoutTime": "11:00",
    "keyLocation": "Caixa de chaves na porta", "accessCode": "",
    "cleaningFee": "40", "sefUser": "", "sefPass": "",
    "primaveraSeries": "AL", "primaveraVatRate": "6",
}

@router.get("")
def get_settings(db: Session = Depends(get_db), _=Auth):
    rows = db.query(models.Settings).all()
    result = dict(DEFAULT_SETTINGS)
    for row in rows:
        result[row.key] = row.value
    return result

@router.put("")
def update_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db), _=Auth):
    for k, v in data.values.items():
        row = db.query(models.Settings).filter(models.Settings.key == k).first()
        if row:
            row.value = str(v)
        else:
            db.add(models.Settings(key=k, value=str(v)))
    db.commit()
    return {"ok": True}

@router.get("/backup")
def backup(db: Session = Depends(get_db), _=Auth):
    def rows(model): return [
        {c.name: getattr(r, c.name) for c in model.__table__.columns}
        for r in db.query(model).all()
    ]
    rows_settings = db.query(models.Settings).all()
    return {
        "properties":        rows(models.Property),
        "reservations":      rows(models.Reservation),
        "transactions":      rows(models.Transaction),
        "cleaning_tasks":    rows(models.CleaningTask),
        "message_templates": rows(models.MessageTemplate),
        "ota_channels":      rows(models.OtaChannel),
        "settings":          {r.key: r.value for r in rows_settings},
    }

@router.post("/test-email")
def test_email(db: Session = Depends(get_db), _=Auth):
    """Send a test email to verify SMTP configuration."""
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    if not smtp_user or not smtp_pass:
        raise HTTPException(400, "SMTP_USER e SMTP_PASS não configurados nos env vars do Render")
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "✓ Teste AL Manager — SMTP a funcionar"
        msg["From"]    = f"AL Manager <{smtp_user}>"
        msg["To"]      = smtp_user
        msg.attach(MIMEText("<p>Email de teste do AL Manager. SMTP está a funcionar correctamente.</p>", "html", "utf-8"))
        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.ehlo(); s.starttls()
            s.login(smtp_user, smtp_pass)
            s.sendmail(smtp_user, smtp_user, msg.as_string())
        return {"ok": True, "sent_to": smtp_user}
    except Exception as e:
        raise HTTPException(500, f"Erro SMTP: {e}")


@router.post("/restore")
def restore(data: schemas.BackupData, db: Session = Depends(get_db), _=Auth):
    # Wipe and restore — careful!
    for model in [models.CleaningTask, models.Transaction, models.Reservation,
                  models.Property, models.MessageTemplate, models.OtaChannel, models.Settings]:
        db.query(model).delete()
    db.commit()

    for p in data.properties:
        db.add(models.Property(**{k: v for k, v in p.items() if k != "created_at"}))
    for r in data.reservations:
        db.add(models.Reservation(**{k: v for k, v in r.items() if k != "created_at"}))
    for t in data.transactions:
        db.add(models.Transaction(**{k: v for k, v in t.items() if k != "created_at"}))
    for c in data.cleaning_tasks:
        db.add(models.CleaningTask(**{k: v for k, v in c.items() if k != "created_at"}))
    for m in data.message_templates:
        db.add(models.MessageTemplate(**{k: v for k, v in m.items() if k != "created_at"}))
    for o in data.ota_channels:
        db.add(models.OtaChannel(**{k: v for k, v in o.items()}))
    for k, v in data.settings.items():
        db.add(models.Settings(key=k, value=str(v)))
    db.commit()
    return {"ok": True}
