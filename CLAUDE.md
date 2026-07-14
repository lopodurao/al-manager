# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AL Manager — web app for managing Alojamento Local (short-term rental) properties in Portugal. Handles reservations, financials, OTA channel sync (Airbnb/Booking.com via iCal), VingCard Livvi smart lock PINs, confirmation/cancellation emails (Brevo API), SEF/SIBA reporting, and Primavera ERP integration (planned).

Deployed on **Render.com free tier** (cold-start after 15 min idle — mitigated by self-ping every 10 min). Database is **Supabase PostgreSQL** via Transaction pooler on port 6543.

## Running locally

```bash
cd al-manager
pip install -r requirements.txt
# SQLite fallback used automatically when DATABASE_URL is not set
uvicorn backend.main:app --reload --port 8000
```

Frontend is served as static files by FastAPI — no separate build step. Open `http://localhost:8000`.

## Key environment variables (Render)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Transaction pooler URL (port 6543) |
| `SECRET_KEY` | JWT signing key |
| `BREVO_API_KEY` | Transactional email (Render blocks all SMTP ports) |
| `SMTP_FROM` | Sender email address (e.g. casadapenha800@gmail.com) |
| `SMTP_FROM_NAME` | Sender display name |
| `LIVVI_CLIENT_ID` / `LIVVI_CLIENT_SECRET` | VingCard Livvi OAuth2 |
| `LIVVI_SITE_ID` | Livvi site ID (738 for Casa da Penha) |
| `RENDER_EXTERNAL_URL` | Set by Render automatically — used for self-ping |

## Architecture

### Backend (`backend/`)

**FastAPI** app with **SQLAlchemy ORM** (sync sessions). All routes require JWT Bearer auth via `Depends(auth.get_current_user)` — aliased as `Auth` in each router.

```
backend/
  main.py          # Lifespan: table creation, migrations, seed data, APScheduler
  models.py        # SQLAlchemy models
  schemas.py       # Pydantic v2 schemas (model_config = {"from_attributes": True})
  database.py      # Engine: PostgreSQL (SSL) or SQLite fallback
  auth.py          # JWT + bcrypt
  livvi_service.py # VingCard Livvi API (async httpx, token cache, door type filtering)
  email_service.py # Brevo HTTP API (not SMTP — blocked by Render)
  routers/
    reservations.py  # overlap check, BackgroundTasks for Livvi+email
    ota.py           # OtaLink CRUD, iCal parse/sync, public calendar feed
    settings.py      # Key-value settings, test-email endpoint
    properties/transactions/cleaning/messages/auth.py
```

**Schema migrations** are done at startup via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in `main.py:_run_migrations()`. New tables use `CREATE TABLE IF NOT EXISTS`. Never drop or rename columns.

**Background tasks**: Livvi PIN creation and confirmation/cancellation emails run in `BackgroundTasks` (non-blocking). Each background function opens its own `SessionLocal()`.

**Scheduled jobs** (APScheduler AsyncIOScheduler):
- `ota.auto_sync_all` every 15 min — syncs all active `OtaLink` records
- `_daily_backup` at 03:00 — SQLite only (no-op on PostgreSQL)
- `_self_ping` every 10 min — prevents Render free tier cold start

### Frontend (`frontend/static/`)

Vanilla JS SPA — no framework, no build step.

```
api.js        # All fetch calls; apiFetch() handles auth headers + error throwing
app.js        # navigate(), auth flow, modal/toast helpers
utils.js      # escHtml, fmtDate, fmtMoney, statusBadge, channelBadge, etc.
sections/     # One file per section; each exports a renderXxx() async function
```

**Navigation**: `navigate(section)` calls `loadCache()` (parallel fetch of all data), then calls the section's `render()` function and sets `innerHTML`. `cache` object in `api.js` holds the last-loaded data.

**Error handling in forms**: catch block sets `errBox.textContent` + `errBox.scrollIntoView()`. The `#res-form-error` div is inside the modal — always check it exists before assuming an error is silent.

### OTA / iCal

- **Import**: `OtaLink` model (prop_id × channel × ical_url). `auto_sync_all()` iterates active links. `_parse_ical()` skips events with duplicate `ical_uid` OR overlapping dates.
- **Export (public)**: `GET /api/ota/calendar/{token}` — no auth, token validated against `icalToken` setting generated at startup. Give this URL to Airbnb/Booking.com.

### Livvi (VingCard smart locks)

`livvi_service.py` authenticates via OAuth2 Basic → JWT (cached). Booking creation uses `/corp/site/v2/booking/new` with `application/x-www-form-urlencoded` and multi-value `doorIds` params. Only `ROOM`, `GENERIC`, `AMENITY` door types are accepted by v2 — `MAIN`/`STAFF` are filtered automatically. Delete uses v1 endpoint (`/corp/site/booking/delete`). Corp=178, Site=738.

Door IDs per property are stored in `Property.livvi_door_ids` (comma-separated string). The mapping of room names → door IDs is in `Settings.livvi_rooms` (JSON).

### Double-booking prevention

`_check_overlap(db, prop_id, checkin, checkout, exclude_id)` is called in both `create_reservation` and `update_reservation`. It also runs inside `_parse_ical` before creating iCal-imported reservations. Raises HTTP 409 with a human-readable message.

## Data model notes

- Dates stored as `VARCHAR` in ISO format (`YYYY-MM-DD`) — string comparison works correctly for ordering/overlap.
- `OtaLink` is the per-property OTA config (replaces the old single `ical_url` on `OtaChannel`).
- `Settings` is a flat key-value table — accessed as a dict via `{row.key: row.value for row in db.query(models.Settings).all()}`.
- `icalToken` in Settings is a UUID generated at startup used to authenticate the public iCal feed.
