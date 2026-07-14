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
| `STRIPE_SECRET_KEY` | Stripe API key — public booking checkout |
| `STRIPE_WEBHOOK_SECRET` | Verifies `POST /api/public/stripe-webhook` signatures |
| `PUBLIC_SITE_URL` | Marketing site origin (casadapenha.pt) — Stripe success/cancel redirect target, NOT this API's own URL |

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
  livvi_service.py  # VingCard Livvi API (async httpx, token cache, door type filtering)
  email_service.py  # Brevo HTTP API (not SMTP — blocked by Render)
  stripe_service.py # Stripe Checkout session creation + webhook signature verification
  booking_logic.py  # check_overlap() — shared between the authenticated and public routers
  routers/
    reservations.py  # overlap check, BackgroundTasks for Livvi+email
    ota.py           # OtaLink CRUD, iCal parse/sync, public calendar feed
    settings.py      # Key-value settings, test-email endpoint
    public.py        # UNAUTHENTICATED — public booking engine for casadapenha.pt (see below)
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

`check_overlap(db, prop_id, checkin, checkout, exclude_id)` lives in `booking_logic.py` (shared by both the authenticated and public routers) and is called from `create_reservation`/`update_reservation` and inside `_parse_ical` before creating iCal-imported reservations. Raises HTTP 409 with a human-readable message.

### Public booking engine (casadapenha.pt)

`routers/public.py` has zero auth — it's what the marketing site calls directly (CORS is already `allow_origins=["*"]`). Only `Property` rows with `public_bookable=True` are ever exposed (currently Quarto Coral and Quarto Bamboo — set via a checkbox on the property form; also needs `nightly_rate` set or booking requests are rejected).

Flow: guest submits `POST /api/public/booking-requests` → creates a `Reservation` with `status='pending'`, `channel='website'`, `deposit_status='awaiting_payment'`, full stay price computed server-side (`nights * nightly_rate` — **never trust a client-submitted price**) → Stripe Checkout Session created, guest redirected there. On `checkout.session.completed` (webhook, signature-verified via `STRIPE_WEBHOOK_SECRET`), `deposit_status` flips to `'paid'` and both the owner (`send_new_booking_request_notification`) and guest (`send_booking_request_received`) are emailed. The owner still has to manually flip `status` to `'confirmed'` in the CRM UI — that PUT now also fires the same Livvi PIN + confirmation-email background task that `create_reservation` fires for brand-new confirmed reservations (see `update_reservation` in `reservations.py`).

A pending-but-unpaid request still blocks those dates (via `check_overlap`) until `_expire_stale_booking_requests` (hourly APScheduler job in `main.py`) auto-cancels anything left in `awaiting_payment` for more than 24h — this exists specifically so an abandoned Stripe Checkout can't squat on dates indefinitely.

Spam protection is a honeypot field (`hp` in `PublicBookingRequest` — must arrive empty) plus the 24h expiry; there's no CAPTCHA or rate-limiting library in this codebase yet.

## Data model notes

- Dates stored as `VARCHAR` in ISO format (`YYYY-MM-DD`) — string comparison works correctly for ordering/overlap.
- `OtaLink` is the per-property OTA config (replaces the old single `ical_url` on `OtaChannel`).
- `Settings` is a flat key-value table — accessed as a dict via `{row.key: row.value for row in db.query(models.Settings).all()}`.
- `icalToken` in Settings is a UUID generated at startup used to authenticate the public iCal feed.
