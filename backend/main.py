from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import date
import os, shutil, logging

from .database import engine, Base
from . import models
from .routers import auth, properties, reservations, transactions, cleaning, messages, ota, settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Lifespan: create tables + seed OTA channels + start scheduler ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _seed_ota_channels()
    _seed_default_messages()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(_daily_backup, "cron", hour=3, minute=0)
    scheduler.add_job(ota.auto_sync_all, "interval", minutes=30)
    scheduler.start()
    logger.info("AL Manager started")
    yield
    scheduler.shutdown()

app = FastAPI(title="AL Manager API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──
app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(reservations.router)
app.include_router(transactions.router)
app.include_router(cleaning.router)
app.include_router(messages.router)
app.include_router(ota.router)
app.include_router(settings.router)

# ── Static frontend ──
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_path):
    app.mount("/static", StaticFiles(directory=os.path.join(frontend_path, "static")), name="static")

    @app.get("/", include_in_schema=False)
    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str = ""):
        # API routes take priority (handled above)
        index = os.path.join(frontend_path, "index.html")
        return FileResponse(index)

# ── Schema migrations (ADD COLUMN IF NOT EXISTS) ──
def _run_migrations():
    """Add new columns to existing tables without dropping data."""
    migrations = [
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS livvi_booking_id VARCHAR DEFAULT ''",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS access_pin VARCHAR DEFAULT ''",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room VARCHAR DEFAULT ''",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(__import__("sqlalchemy").text(sql))
                conn.commit()
            except Exception as e:
                logger.warning(f"Migration skipped ({e})")

# ── Seed helpers ──
def _seed_ota_channels():
    from .database import SessionLocal
    from . import models
    db = SessionLocal()
    try:
        if db.query(models.OtaChannel).count() == 0:
            for ch in [
                models.OtaChannel(id="ota1", name="Airbnb",      slug="airbnb",  active=False),
                models.OtaChannel(id="ota2", name="Booking.com", slug="booking", active=False),
                models.OtaChannel(id="ota3", name="Livvi",       slug="livvi",   active=False),
            ]:
                db.add(ch)
            db.commit()
    finally:
        db.close()

def _seed_default_messages():
    from .database import SessionLocal
    from . import models
    import uuid
    db = SessionLocal()
    try:
        if db.query(models.MessageTemplate).count() == 0:
            db.add(models.MessageTemplate(
                id=str(uuid.uuid4()), name="Boas-vindas",
                trigger="checkin-1d", channel="all",
                subject="Boas-vindas ao {{property}}!",
                body="Olá {{guest}},\n\nEstamos muito felizes por receber-vos no {{property}}!\n\nO check-in é a partir das {{checkin_time}}h.\nO código de acesso é: {{access_code}}\n\nQualquer dúvida, estamos à disposição.\n\nBoas férias!",
                active=True
            ))
            db.add(models.MessageTemplate(
                id=str(uuid.uuid4()), name="Pré check-out",
                trigger="checkout-1d", channel="all",
                subject="Informações de saída — {{property}}",
                body="Olá {{guest}},\n\nLembramos que o check-out é amanhã até às {{checkout_time}}h.\n\nPor favor deixe as chaves em {{key_location}}.\n\nObrigado pela vossa estadia!",
                active=True
            ))
            db.commit()
    finally:
        db.close()

# ── Daily backup ──
def _daily_backup():
    db_path = os.getenv("DB_PATH", "./al_manager.db")
    if not os.path.exists(db_path):
        return
    backup_dir = os.getenv("BACKUP_DIR", "./backups")
    os.makedirs(backup_dir, exist_ok=True)
    dest = os.path.join(backup_dir, f"al_manager_{date.today()}.db")
    shutil.copy2(db_path, dest)
    # Keep only last 7 backups
    backups = sorted(f for f in os.listdir(backup_dir) if f.endswith(".db"))
    for old in backups[:-7]:
        os.remove(os.path.join(backup_dir, old))
    logger.info(f"Backup criado: {dest}")
