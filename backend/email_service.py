import smtplib, os, logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)

def _send(to: str, subject: str, html: str) -> bool:
    if not SMTP_USER or not SMTP_PASS or not to:
        logger.warning(f"Email não enviado (config em falta ou sem destinatário): {to}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Casa da Penha <{SMTP_FROM}>"
        msg["To"]      = to
        msg.attach(MIMEText(html, "html", "utf-8"))
        with smtplib.SMTP("smtp.gmail.com", 587) as s:
            s.ehlo()
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, to, msg.as_string())
        logger.info(f"Email enviado para {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Erro ao enviar email para {to}: {e}")
        return False


def send_booking_confirmation(reservation, property_obj, settings: dict, access_pin: str = "") -> bool:
    if not reservation.guest_email:
        return False

    checkin_time  = settings.get("checkinTime",  "15:00")
    checkout_time = settings.get("checkoutTime", "11:00")
    access_code   = settings.get("accessCode",   "—")
    key_location  = settings.get("keyLocation",  "—")
    owner_phone   = settings.get("ownerPhone",   "—")
    prop_name     = property_obj.name if property_obj else "Alojamento"
    prop_addr     = property_obj.address if property_obj else ""

    nights = (
        __import__("datetime").date.fromisoformat(reservation.checkout) -
        __import__("datetime").date.fromisoformat(reservation.checkin)
    ).days

    channel_label = {
        "airbnb": "Airbnb", "booking": "Booking.com",
        "livvi": "Livvi", "direct": "Reserva Direta"
    }.get(reservation.channel, reservation.channel)

    html = f"""
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8">
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 24px; color: #1f2937; }}
  .wrap {{ max-width: 580px; margin: 0 auto; }}
  .header {{ background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 16px 16px 0 0; padding: 36px 32px; text-align: center; color: white; }}
  .header h1 {{ margin: 0; font-size: 26px; font-weight: 800; }}
  .header p  {{ margin: 8px 0 0; opacity: .85; font-size: 15px; }}
  .body {{ background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }}
  .greeting {{ font-size: 17px; font-weight: 600; margin-bottom: 20px; }}
  .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }}
  .info-box {{ background: #f9fafb; border-radius: 10px; padding: 14px 16px; border: 1px solid #e5e7eb; }}
  .info-box .label {{ font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; font-weight: 600; margin-bottom: 4px; }}
  .info-box .value {{ font-size: 15px; font-weight: 700; color: #111827; }}
  .access {{ background: #eef2ff; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #6366f1; }}
  .access h3 {{ margin: 0 0 12px; color: #4338ca; font-size: 15px; }}
  .access p  {{ margin: 6px 0; font-size: 14px; }}
  .access strong {{ color: #111827; }}
  .footer {{ margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; text-align: center; }}
  .badge {{ display: inline-block; background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🏠 {prop_name}</h1>
    <p>Confirmação de reserva</p>
  </div>
  <div class="body">
    <span class="badge">✓ Reserva confirmada via {channel_label}</span>
    <div class="greeting">Olá {reservation.guest_name},</div>
    <p style="color:#4b5563;line-height:1.7">
      A sua reserva está confirmada! Estamos muito felizes por recebê-lo(a) em <strong>{prop_name}</strong>.
      Encontra abaixo todos os detalhes da sua estadia.
    </p>
    <div class="info-grid">
      <div class="info-box">
        <div class="label">Check-in</div>
        <div class="value">{reservation.checkin}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:2px">a partir das {checkin_time}h</div>
      </div>
      <div class="info-box">
        <div class="label">Check-out</div>
        <div class="value">{reservation.checkout}</div>
        <div style="font-size:13px;color:#6b7280;margin-top:2px">até às {checkout_time}h</div>
      </div>
      <div class="info-box">
        <div class="label">Duração</div>
        <div class="value">{nights} noite{"s" if nights != 1 else ""}</div>
      </div>
      <div class="info-box">
        <div class="label">Alojamento</div>
        <div class="value" style="font-size:13px">{prop_name}</div>
        {"<div style='font-size:12px;color:#6b7280;margin-top:2px'>" + prop_addr + "</div>" if prop_addr else ""}
      </div>
    </div>
    <div class="access">
      <h3>🔑 Instruções de acesso</h3>
      {"<p>🔒 Código PIN da fechadura: <strong style='font-size:22px;letter-spacing:.15em;color:#4338ca'>" + access_pin + "</strong></p>" if access_pin and access_pin != "—" else f"<p>Código de acesso: <strong>{access_code}</strong></p>"}
      <p>Chaves: <strong>{key_location}</strong></p>
    </div>
    <p style="color:#4b5563;font-size:14px;line-height:1.7">
      Qualquer questão antes ou durante a estadia, contacte-nos pelo <strong>{owner_phone}</strong>.
      Desejamos uma excelente estadia!
    </p>
    <div class="footer">
      Este email foi enviado automaticamente pelo sistema AL Manager.<br>
      {prop_name} · {prop_addr}
    </div>
  </div>
</div>
</body>
</html>
"""
    return _send(
        to=reservation.guest_email,
        subject=f"✓ Reserva confirmada — {prop_name} | {reservation.checkin} → {reservation.checkout}",
        html=html
    )
