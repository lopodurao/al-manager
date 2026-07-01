import httpx, os, base64, logging
from datetime import datetime, timezone
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

LIVVI_CLIENT_ID     = os.getenv("LIVVI_CLIENT_ID", "")
LIVVI_CLIENT_SECRET = os.getenv("LIVVI_CLIENT_SECRET", "")
LIVVI_SITE_ID       = os.getenv("LIVVI_SITE_ID", "738")  # site 738 dentro do corp 178
LIVVI_DOOR_IDS      = os.getenv("LIVVI_DOOR_IDS", "27462,27463")  # ROOM-type doors only
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
    door_ids: list[str] | None = None,
) -> dict | None:
    """Create a Livvi booking and return PIN code for the guest."""
    if not LIVVI_CLIENT_ID or not LIVVI_CLIENT_SECRET:
        logger.warning("Livvi não configurado — booking não criado")
        return None

    try:
        token = await _get_token()
        start_dt = f"{checkin}T15:00:00"
        end_dt   = f"{checkout}T11:00:00"

        name_parts = guest_name.split(",", 1)
        surname = name_parts[0].strip()
        first   = name_parts[1].strip() if len(name_parts) > 1 else surname

        # Use provided door_ids, or fall back to env var
        if not door_ids:
            door_ids = [d.strip() for d in LIVVI_DOOR_IDS.split(",") if d.strip()]

        params = [
            ("siteId", LIVVI_SITE_ID),
            ("startDateTime", start_dt),
            ("endDateTime", end_dt),
            ("integrationId", reservation_id[:50]),
            ("allowedPersonalData", "true"),
            ("sendPasscode", "false"),
            ("mainGuest.name", first),
            ("mainGuest.surname", surname),
        ] + [("doorIds", did) for did in door_ids]

        if guest_email:
            params.append(("mainGuest.email", guest_email))

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{LIVVI_API_BASE}/corp/site/v2/booking/new",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                content=urlencode(params).encode(),
            )
            data = r.json()
            if r.status_code == 200:
                pin = _extract_pin(data)
                booking_id = str(data.get("id", ""))
                logger.info(f"Livvi booking {booking_id} criado para {guest_name}: PIN={pin}")
                return {"booking_id": booking_id, "pin": pin, "raw": data}
            else:
                logger.error(f"Livvi booking erro {r.status_code}: {data}")
                return None
    except Exception as e:
        logger.error(f"Livvi create_booking exception: {e}")
        return None


async def delete_booking(livvi_booking_id: str) -> bool:
    """Delete a Livvi booking on reservation cancellation."""
    if not LIVVI_CLIENT_ID or not livvi_booking_id:
        return False
    try:
        token = await _get_token()
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{LIVVI_API_BASE}/corp/site/booking/delete",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                content=urlencode([("siteId", LIVVI_SITE_ID), ("bookingId", int(livvi_booking_id))]).encode(),
            )
            return r.status_code == 200
    except Exception as e:
        logger.error(f"Livvi delete_booking exception: {e}")
        return False


def _extract_pin(data: dict) -> str:
    """Extract PIN from Livvi booking response (in mainGuest.passcode)."""
    main_guest = data.get("mainGuest", {})
    if main_guest:
        for key in ("passcode", "pin", "pinCode", "accessCode", "code"):
            if main_guest.get(key):
                return str(main_guest[key])
    for key in ("passcode", "pin", "pinCode", "accessCode", "code"):
        if data.get(key):
            return str(data[key])
    return "—"
