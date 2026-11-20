import os, logging, httpx

logger = logging.getLogger(__name__)

BREVO_API_KEY  = os.getenv("BREVO_API_KEY", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Casa da Penha")
SMTP_FROM_ADDR = os.getenv("SMTP_FROM", os.getenv("SMTP_USER", ""))


def _send(to: str, subject: str, html: str) -> bool:
    if not to:
        logger.warning("Email não enviado: sem destinatário")
        return False
    if not BREVO_API_KEY:
        logger.warning("Email não enviado: BREVO_API_KEY não configurado nos env vars do Render")
        return False
    if not SMTP_FROM_ADDR:
        logger.warning("Email não enviado: SMTP_FROM (email do remetente) não configurado")
        return False
    try:
        r = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": BREVO_API_KEY, "Content-Type": "application/json"},
            json={
                "sender":      {"name": SMTP_FROM_NAME, "email": SMTP_FROM_ADDR},
                "to":          [{"email": to}],
                "subject":     subject,
                "htmlContent": html,
            },
            timeout=15,
        )
        data = r.json()
        if r.status_code in (200, 201):
            logger.info(f"Email enviado via Brevo para {to}: {subject} (id={data.get('messageId','')})")
            return True
        else:
            logger.error(f"Brevo erro {r.status_code}: {data}")
            return False
    except Exception as e:
        logger.error(f"Erro ao enviar email para {to}: {e}")
        return False


def send_booking_confirmation(reservation, property_obj, settings: dict, access_pin: str = "") -> bool:
    if not reservation.guest_email:
        return False

    owner_phone   = settings.get("ownerPhone",   "—")
    wifi_network  = settings.get("wifiNetwork",  "")
    wifi_password = settings.get("wifiPassword", "")
    prop_name     = property_obj.name if property_obj else "Alojamento"
    prop_addr     = property_obj.address if property_obj else "Avenida Portugal 800, 2765-272 Estoril, Portugal"

    first_name = reservation.guest_name.split()[0] if reservation.guest_name else reservation.guest_name
    pin = access_pin if access_pin and access_pin != "—" else ""

    pin_block = f"""
      <tr><td style="padding:16px 0 4px;font-size:13px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Your Access Code</td></tr>
      <tr><td style="padding:4px 0 16px">
        <div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:10px;padding:14px 20px;display:inline-block">
          <span style="font-size:28px;font-weight:800;letter-spacing:4px;color:#15803d;font-family:monospace">{pin}</span>
        </div>
      </td></tr>""" if pin else ""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Check-in instructions – {prop_name}</title>
</head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px;color:#1f2937">
<div style="max-width:580px;margin:0 auto">

  <div style="background:#1e293b;border-radius:12px 12px 0 0;padding:32px;text-align:center;color:white">
    <div style="font-size:28px;margin-bottom:8px">🏠</div>
    <h1 style="margin:0;font-size:22px;font-weight:800">{prop_name}</h1>
    <p style="margin:6px 0 0;opacity:.75;font-size:14px">Check-in instructions – Estoril</p>
  </div>

  <div style="background:white;border-radius:0 0 12px 12px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
    <p style="font-size:16px;font-weight:600;margin:0 0 12px">Dear {first_name},</p>
    <p style="color:#4b5563;line-height:1.7;margin:0 0 24px">
      We are looking forward to welcoming you to {prop_name} in Estoril!
      Ahead of your arrival, here are your check-in details and step-by-step instructions
      so you can settle in smoothly.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr><td colspan="2" style="padding-bottom:8px;font-size:15px;font-weight:700;color:#1e293b;border-bottom:2px solid #e5e7eb">Reservation &amp; Arrival Details</td></tr>
      <tr>
        <td style="padding:12px 16px 12px 0;font-size:13px;color:#6b7280;font-weight:600;width:40%">Check-in</td>
        <td style="padding:12px 0;font-size:14px;font-weight:700">{reservation.checkin}, from 4:00 PM</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:12px 16px 12px 0;font-size:13px;color:#6b7280;font-weight:600">Check-out</td>
        <td style="padding:12px 0;font-size:14px;font-weight:700">{reservation.checkout}, by 11:00 AM</td>
      </tr>
      <tr>
        <td style="padding:12px 16px 12px 0;font-size:13px;color:#6b7280;font-weight:600">Accommodation</td>
        <td style="padding:12px 0;font-size:14px;font-weight:700">{prop_name}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:12px 16px 12px 0;font-size:13px;color:#6b7280;font-weight:600">Address</td>
        <td style="padding:12px 0;font-size:14px">{prop_addr}</td>
      </tr>
      {pin_block}
    </table>

    <div style="margin:28px 0 0;padding-top:20px;border-top:2px solid #e5e7eb">
      <p style="font-size:15px;font-weight:700;margin:0 0 16px;color:#1e293b">How to Enter</p>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px">
        <strong>Main Entrance:</strong> Upon arrival at Avenida Portugal 800, locate the intercom keypad
        to the right of the door{f" and enter <strong style='font-family:monospace;color:#15803d'>{pin}</strong> to unlock it" if pin else " and enter your access code to unlock it"}.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px">
        <strong>Reaching the House:</strong> Once inside, walk up the stairs until you reach the house,
        then turn right and continue until you find a wooden door.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px">
        <strong>Wooden Door:</strong> To unlock this door, wave your open hand vertically across the screen
        (top to bottom or bottom to top) so the numbers light up.
        Enter {"<strong style='font-family:monospace;color:#15803d'>" + pin + "</strong>" if pin else "your access code"} and press ✔️.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.7;margin:0">
        <strong>Your Room ({prop_name}):</strong> Once inside the apartment, your assigned room is the
        first door on the left. Use the same access code
        {"(<strong style='font-family:monospace;color:#15803d'>" + pin + "</strong>) " if pin else ""}to enter.
      </p>
    </div>

    {"<div style='margin:24px 0 0;padding:16px 20px;background:#eff6ff;border-radius:10px;border-left:4px solid #3b82f6'><p style='margin:0;font-size:14px;color:#1e40af'><strong>Wi-Fi</strong> — Network: <strong>" + wifi_network + "</strong> · Password: <strong>" + wifi_password + "</strong></p></div>" if wifi_network else ""}

    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:24px 0 0">
      During your stay, you have complimentary access to the shared facilities applicable to your
      reservation, including the garden and shared kitchenette.
    </p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:12px 0 0">
      If you have any questions or need assistance upon arrival, please do not hesitate to
      contact us at <strong>{owner_phone}</strong>.
    </p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:12px 0 24px">
      Thank you for choosing {prop_name}, and we wish you a wonderful stay in Estoril!
    </p>
    <p style="font-size:14px;margin:0">Kind regards,<br><strong>The {prop_name} Team</strong></p>

    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      {prop_name} · {prop_addr}
    </div>
  </div>
</div>
</body>
</html>"""
    return _send(
        to=reservation.guest_email,
        subject=f"Check-in instructions – {prop_name}, Estoril | {reservation.checkin}",
        html=html
    )


def send_cancellation_email(reservation, property_obj, settings: dict) -> bool:
    if not reservation.guest_email:
        return False

    owner_phone = settings.get("ownerPhone", "—")
    owner_email = settings.get("ownerEmail", SMTP_FROM_ADDR)
    prop_name   = property_obj.name if property_obj else "Alojamento"
    prop_addr   = property_obj.address if property_obj else ""

    nights = (
        __import__("datetime").date.fromisoformat(reservation.checkout) -
        __import__("datetime").date.fromisoformat(reservation.checkin)
    ).days

    html = f"""
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8">
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 24px; color: #1f2937; }}
  .wrap {{ max-width: 580px; margin: 0 auto; }}
  .header {{ background: linear-gradient(135deg, #ef4444, #b91c1c); border-radius: 16px 16px 0 0; padding: 36px 32px; text-align: center; color: white; }}
  .header h1 {{ margin: 0; font-size: 26px; font-weight: 800; }}
  .header p  {{ margin: 8px 0 0; opacity: .85; font-size: 15px; }}
  .body {{ background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }}
  .info-box {{ background: #f9fafb; border-radius: 10px; padding: 16px; border: 1px solid #e5e7eb; margin: 20px 0; }}
  .info-box .row {{ display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size:14px; }}
  .info-box .row:last-child {{ border-bottom: none; }}
  .contact {{ background: #eff6ff; border-radius: 12px; padding: 18px; margin: 20px 0; border-left: 4px solid #3b82f6; font-size:14px; }}
  .footer {{ margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; text-align: center; }}
  .badge {{ display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🏠 {prop_name}</h1>
    <p>Cancelamento de reserva</p>
  </div>
  <div class="body">
    <span class="badge">✗ Reserva cancelada</span>
    <p style="font-size:16px;font-weight:600">Olá {reservation.guest_name},</p>
    <p style="color:#4b5563;line-height:1.7">
      Informamos que a sua reserva em <strong>{prop_name}</strong> foi cancelada.
      Os detalhes da reserva cancelada são os seguintes:
    </p>
    <div class="info-box">
      <div class="row"><span style="color:#6b7280">Alojamento</span><strong>{prop_name}</strong></div>
      <div class="row"><span style="color:#6b7280">Check-in</span><strong>{reservation.checkin}</strong></div>
      <div class="row"><span style="color:#6b7280">Check-out</span><strong>{reservation.checkout}</strong></div>
      <div class="row"><span style="color:#6b7280">Duração</span><strong>{nights} noite{"s" if nights != 1 else ""}</strong></div>
    </div>
    <div class="contact">
      <strong>Questões sobre o cancelamento?</strong><br>
      Contacte-nos pelo <strong>{owner_phone}</strong> ou responda a este email (<strong>{owner_email}</strong>).
    </div>
    <p style="color:#4b5563;font-size:14px;line-height:1.7">
      Pedimos desculpa pelo incómodo e esperamos poder recebê-lo(a) numa oportunidade futura.
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
        subject=f"✗ Reserva cancelada — {prop_name} | {reservation.checkin} → {reservation.checkout}",
        html=html
    )


def send_new_booking_request_notification(reservation, property_obj, settings: dict) -> bool:
    """Notify the OWNER that a paid booking request came in from the website and needs review."""
    owner_email = settings.get("ownerEmail", SMTP_FROM_ADDR)
    if not owner_email:
        return False

    prop_name = property_obj.name if property_obj else "Alojamento"

    nights = (
        __import__("datetime").date.fromisoformat(reservation.checkout) -
        __import__("datetime").date.fromisoformat(reservation.checkin)
    ).days

    html = f"""
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8">
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 24px; color: #1f2937; }}
  .wrap {{ max-width: 580px; margin: 0 auto; }}
  .header {{ background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 16px 16px 0 0; padding: 36px 32px; text-align: center; color: white; }}
  .header h1 {{ margin: 0; font-size: 26px; font-weight: 800; }}
  .header p  {{ margin: 8px 0 0; opacity: .85; font-size: 15px; }}
  .body {{ background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }}
  .info-box {{ background: #f9fafb; border-radius: 10px; padding: 16px; border: 1px solid #e5e7eb; margin: 20px 0; }}
  .info-box .row {{ display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size:14px; }}
  .info-box .row:last-child {{ border-bottom: none; }}
  .footer {{ margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; text-align: center; }}
  .badge {{ display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🏠 {prop_name}</h1>
    <p>Novo pedido de reserva pago — website</p>
  </div>
  <div class="body">
    <span class="badge">⏳ Aguarda confirmação</span>
    <p style="color:#4b5563;line-height:1.7">
      Chegou um pedido de reserva pelo site, com pagamento já efetuado. Reveja e confirme no AL Manager
      para gerar o PIN de acesso e enviar a confirmação ao hóspede.
    </p>
    <div class="info-box">
      <div class="row"><span style="color:#6b7280">Alojamento</span><strong>{prop_name}</strong></div>
      <div class="row"><span style="color:#6b7280">Hóspede</span><strong>{reservation.guest_name}</strong></div>
      <div class="row"><span style="color:#6b7280">Contacto</span><strong>{reservation.guest_email} · {reservation.guest_phone or "—"}</strong></div>
      <div class="row"><span style="color:#6b7280">Check-in</span><strong>{reservation.checkin}</strong></div>
      <div class="row"><span style="color:#6b7280">Check-out</span><strong>{reservation.checkout}</strong></div>
      <div class="row"><span style="color:#6b7280">Duração</span><strong>{nights} noite{"s" if nights != 1 else ""}</strong></div>
      <div class="row"><span style="color:#6b7280">Hóspedes</span><strong>{reservation.guests}</strong></div>
      <div class="row"><span style="color:#6b7280">Valor pago</span><strong>{reservation.price:.2f} €</strong></div>
    </div>
    <div class="footer">
      Este email foi enviado automaticamente pelo sistema AL Manager.<br>
      {prop_name}
    </div>
  </div>
</div>
</body>
</html>
"""
    return _send(
        to=owner_email,
        subject=f"⏳ Novo pedido de reserva (pago) — {prop_name} | {reservation.checkin} → {reservation.checkout}",
        html=html
    )


def send_booking_request_received(reservation, property_obj) -> bool:
    """Acknowledge to the GUEST that their paid booking request was received and is pending confirmation."""
    if not reservation.guest_email:
        return False

    prop_name = property_obj.name if property_obj else "Alojamento"

    nights = (
        __import__("datetime").date.fromisoformat(reservation.checkout) -
        __import__("datetime").date.fromisoformat(reservation.checkin)
    ).days

    html = f"""
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8">
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f7; margin: 0; padding: 24px; color: #1f2937; }}
  .wrap {{ max-width: 580px; margin: 0 auto; }}
  .header {{ background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 16px 16px 0 0; padding: 36px 32px; text-align: center; color: white; }}
  .header h1 {{ margin: 0; font-size: 26px; font-weight: 800; }}
  .header p  {{ margin: 8px 0 0; opacity: .85; font-size: 15px; }}
  .body {{ background: white; border-radius: 0 0 16px 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,.08); }}
  .info-box {{ background: #f9fafb; border-radius: 10px; padding: 16px; border: 1px solid #e5e7eb; margin: 20px 0; }}
  .info-box .row {{ display:flex; justify-content:space-between; padding: 6px 0; border-bottom: 1px solid #f3f4f6; font-size:14px; }}
  .info-box .row:last-child {{ border-bottom: none; }}
  .footer {{ margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 13px; color: #6b7280; text-align: center; }}
  .badge {{ display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>🏠 {prop_name}</h1>
    <p>Pedido de reserva recebido</p>
  </div>
  <div class="body">
    <span class="badge">⏳ Pagamento recebido — aguarda confirmação</span>
    <p style="font-size:16px;font-weight:600">Olá {reservation.guest_name},</p>
    <p style="color:#4b5563;line-height:1.7">
      Recebemos o seu pedido de reserva e o respetivo pagamento. O pedido está agora a aguardar
      confirmação — receberá um novo email assim que for confirmado.
    </p>
    <div class="info-box">
      <div class="row"><span style="color:#6b7280">Alojamento</span><strong>{prop_name}</strong></div>
      <div class="row"><span style="color:#6b7280">Check-in</span><strong>{reservation.checkin}</strong></div>
      <div class="row"><span style="color:#6b7280">Check-out</span><strong>{reservation.checkout}</strong></div>
      <div class="row"><span style="color:#6b7280">Duração</span><strong>{nights} noite{"s" if nights != 1 else ""}</strong></div>
      <div class="row"><span style="color:#6b7280">Valor pago</span><strong>{reservation.price:.2f} €</strong></div>
    </div>
    <div class="footer">
      Este email foi enviado automaticamente pelo sistema AL Manager.<br>
      {prop_name}
    </div>
  </div>
</div>
</body>
</html>
"""
    return _send(
        to=reservation.guest_email,
        subject=f"⏳ Pedido de reserva recebido — {prop_name} | {reservation.checkin} → {reservation.checkout}",
        html=html
    )
