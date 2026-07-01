import httpx, os, base64, logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

LIVVI_CLIENT_ID     = os.getenv("LIVVI_CLIENT_ID", "")
LIVVI_CLIENT_SECRET = os.getenv("LIVVI_CLIENT_SECRET", "")
LIVVI_SITE_ID       = os.getenv("LIVVI_SITE_ID", "178738")
LIVVI_AUTH_URL      = "https://api.athos.vingcard.com/corp/auth/m2m"
LIVVI_API_BASE      = "https://api.athos.vingcard.com"

_cached_token: dict = {}


async def _get_token() -> str:
    global _cached_token
    now = datetime.now(timezone.utc).timestamp()
    if _cached_token.get("token") and _cached_token.get("expires_at", 0) - 300 > now:
        return _cached_token["token"]

    creds = base64.b64encode(f"{LIVVI_CLIENT_ID}:{LIVVI_CLIENT_SECRET}".encode()).decode()
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            LIVVI_AUTH_URL,
            headers={"Authorization": f"Basic {creds}"},
            content=b"",
        )
        r.raise_for_status()
        data = r.json()
        _cached_token = {
            "token": data["access_token"],
            "expires_at": now + data.get("expires_in", 43200),
        }
        return _cached_token["token"]


async def create_booking(
    reservation_id: str,
    guest_name: str,
    guest_email: str,
    checkin: str,    # "YYYY-MM-DD"
    checkout: str,   # "YYYY-MM-DD"
) -> dict | None:
    """Create a Livvi booking and return the result (includes PIN code)."""
    if not LIVVI_CLIENT_ID or not LIVVI_CLIENT_SECRET:
        logger.warning("Livvi não configurado — booking não criado")
        return None

    try:
        token = await _get_token()
        # Livvi expects datetime format: "YYYY-MM-DD HH:mm" (space separator, no seconds)
        start_dt = f"{checkin} 15:00"
        end_dt   = f"{checkout} 11:00"
        name_parts = guest_name.split(",", 1)
        surname = name_parts[0].strip()
        first   = name_parts[1].strip() if len(name_parts) > 1 else surname

        payload = (
            f"siteId={LIVVI_SITE_ID}"
            f"&name={first}"
            f"&surname={surname}"
            f"&startdatetime={start_dt}"
            f"&enddatetime={end_dt}"
            f"&externalid={reservation_id}"
            f"&allowedPersonalData=true"
            + (f"&email={guest_email}" if guest_email else "")
            + "&sendAccessByEmail=false"
        )

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{LIVVI_API_BASE}/corp/site/v2/booking/new",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                content=payload.encode(),
            )
            data = r.json()
            if r.status_code == 200:
                pin = _extract_pin(data)
                logger.info(f"Livvi booking criado para {guest_name}: PIN={pin}")
                return {"booking_id": data.get("id"), "pin": pin, "raw": data}
            else:
                logger.error(f"Livvi booking erro {r.status_code}: {data}")
                return None
    except Exception as e:
        logger.error(f"Livvi create_booking exception: {e}")
        return None


async def delete_booking(livvi_booking_id: str) -> bool:
    """Delete a Livvi booking (e.g. on reservation cancellation)."""
    if not LIVVI_CLIENT_ID or not livvi_booking_id:
        return False
    try:
        token = await _get_token()
        payload = f"siteId={LIVVI_SITE_ID}&bookingId={livvi_booking_id}"
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{LIVVI_API_BASE}/corp/site/v2/booking/delete",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                content=payload.encode(),
            )
            return r.status_code == 200
    except Exception as e:
        logger.error(f"Livvi delete_booking exception: {e}")
        return False


def _extract_pin(data: dict) -> str:
    """Extract PIN from Livvi booking response."""
    # PIN may be in guests[0].pin or accessCode or pinCode
    guests = data.get("guests", [])
    if guests:
        guest = guests[0] if isinstance(guests, list) else guests
        for key in ("pin", "pinCode", "accessCode", "code"):
            if guest.get(key):
                return str(guest[key])
    for key in ("pin", "pinCode", "accessCode", "code", "access_code"):
        if data.get(key):
            return str(data[key])
    return "—"
