from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from .database import Base

def now_utc():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id       = Column(String, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    email    = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_utc)

class Property(Base):
    __tablename__ = "properties"
    id        = Column(String, primary_key=True)
    name      = Column(String, nullable=False)
    address   = Column(String, default="")
    type      = Column(String, default="Apartamento")
    rooms     = Column(Integer, default=1)
    beds      = Column(Integer, default=2)
    baths     = Column(Integer, default=1)
    max_guests = Column(Integer, default=4)
    license        = Column(String, default="")
    color          = Column(String, default="#667eea")
    livvi_door_ids = Column(String, default="")
    notes          = Column(Text, default="")
    nightly_rate    = Column(Float, default=0)
    public_bookable = Column(Boolean, default=False)
    created_at = Column(DateTime, default=now_utc)
    reservations = relationship("Reservation", back_populates="property", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="property", cascade="all, delete-orphan")
    cleaning_tasks = relationship("CleaningTask", back_populates="property", cascade="all, delete-orphan")

class Reservation(Base):
    __tablename__ = "reservations"
    id               = Column(String, primary_key=True)
    prop_id          = Column(String, ForeignKey("properties.id"), nullable=False)
    guest_name       = Column(String, nullable=False)
    guest_email      = Column(String, default="")
    guest_phone      = Column(String, default="")
    guest_nationality = Column(String, default="PT")
    doc_id           = Column(String, default="")
    guests           = Column(Integer, default=2)
    checkin          = Column(String, nullable=False)
    checkout         = Column(String, nullable=False)
    channel          = Column(String, default="direct")
    status           = Column(String, default="confirmed")
    price            = Column(Float, default=0)
    commission       = Column(Float, default=0)
    sef_reported     = Column(Boolean, default=False)
    ical_uid         = Column(String, default="")
    room             = Column(String, default="")
    livvi_booking_id = Column(String, default="")
    access_pin       = Column(String, default="")
    notes            = Column(Text, default="")
    deposit_status     = Column(String, default="")
    stripe_session_id  = Column(String, default="")
    created_at       = Column(DateTime, default=now_utc)
    property = relationship("Property", back_populates="reservations")

class Transaction(Base):
    __tablename__ = "transactions"
    id       = Column(String, primary_key=True)
    prop_id  = Column(String, ForeignKey("properties.id"), nullable=False)
    res_id   = Column(String, default="")
    date     = Column(String, nullable=False)
    type     = Column(String, nullable=False)   # income | expense
    category = Column(String, default="Outros")
    amount   = Column(Float, nullable=False)
    channel  = Column(String, default="")
    desc     = Column(String, default="")
    created_at = Column(DateTime, default=now_utc)
    property = relationship("Property", back_populates="transactions")

class CleaningTask(Base):
    __tablename__ = "cleaning_tasks"
    id       = Column(String, primary_key=True)
    prop_id  = Column(String, ForeignKey("properties.id"), nullable=False)
    type     = Column(String, default="limpeza")   # limpeza | manutencao
    assignee = Column(String, default="")
    date     = Column(String, nullable=False)
    status   = Column(String, default="pending")   # pending | done
    priority = Column(String, default="medium")    # high | medium | low
    notes    = Column(Text, default="")
    created_at = Column(DateTime, default=now_utc)
    property = relationship("Property", back_populates="cleaning_tasks")

class MessageTemplate(Base):
    __tablename__ = "message_templates"
    id       = Column(String, primary_key=True)
    name     = Column(String, nullable=False)
    trigger  = Column(String, default="checkin-1d")
    channel  = Column(String, default="all")
    subject  = Column(String, default="")
    body     = Column(Text, default="")
    active   = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_utc)

class OtaChannel(Base):
    __tablename__ = "ota_channels"
    id        = Column(String, primary_key=True)
    name      = Column(String, nullable=False)
    slug      = Column(String, nullable=False)
    ical_url  = Column(String, default="")
    last_sync = Column(String, default="")
    active    = Column(Boolean, default=False)

class OtaLink(Base):
    """Per-property OTA iCal configuration — one row per (property × channel)."""
    __tablename__ = "ota_links"
    id        = Column(String, primary_key=True)
    prop_id   = Column(String, ForeignKey("properties.id"), nullable=False)
    channel   = Column(String, nullable=False)   # airbnb | booking | livvi | direct
    ical_url  = Column(String, default="")       # URL to pull reservations FROM the OTA
    last_sync = Column(String, default="")
    active    = Column(Boolean, default=True)

class Settings(Base):
    __tablename__ = "settings"
    key   = Column(String, primary_key=True)
    value = Column(Text, default="")
