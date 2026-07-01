from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Auth
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    model_config = {"from_attributes": True}

class Token(BaseModel):
    access_token: str
    token_type: str

# Property
class PropertyCreate(BaseModel):
    name: str
    address: str = ""
    type: str = "Apartamento"
    rooms: int = 1
    beds: int = 2
    baths: int = 1
    max_guests: int = 4
    license: str = ""
    color: str = "#667eea"
    notes: str = ""

class PropertyOut(PropertyCreate):
    id: str
    created_at: datetime
    model_config = {"from_attributes": True}

# Reservation
class ReservationCreate(BaseModel):
    prop_id: str
    guest_name: str
    guest_email: str = ""
    guest_phone: str = ""
    guest_nationality: str = "PT"
    doc_id: str = ""
    guests: int = 2
    checkin: str
    checkout: str
    channel: str = "direct"
    status: str = "confirmed"
    price: float = 0
    commission: float = 0
    sef_reported: bool = False
    notes: str = ""

class ReservationOut(ReservationCreate):
    id: str
    ical_uid: str = ""
    created_at: datetime
    model_config = {"from_attributes": True}

class ReservationUpdate(ReservationCreate):
    pass

# Transaction
class TransactionCreate(BaseModel):
    prop_id: str
    res_id: str = ""
    date: str
    type: str
    category: str = "Outros"
    amount: float
    channel: str = ""
    desc: str = ""

class TransactionOut(TransactionCreate):
    id: str
    created_at: datetime
    model_config = {"from_attributes": True}

# CleaningTask
class CleaningTaskCreate(BaseModel):
    prop_id: str
    type: str = "limpeza"
    assignee: str = ""
    date: str
    status: str = "pending"
    priority: str = "medium"
    notes: str = ""

class CleaningTaskOut(CleaningTaskCreate):
    id: str
    created_at: datetime
    model_config = {"from_attributes": True}

# MessageTemplate
class MessageTemplateCreate(BaseModel):
    name: str
    trigger: str = "checkin-1d"
    channel: str = "all"
    subject: str = ""
    body: str = ""
    active: bool = True

class MessageTemplateOut(MessageTemplateCreate):
    id: str
    created_at: datetime
    model_config = {"from_attributes": True}

# OtaChannel
class OtaChannelUpdate(BaseModel):
    ical_url: str = ""
    active: bool = False

class OtaChannelOut(BaseModel):
    id: str
    name: str
    slug: str
    ical_url: str
    last_sync: str
    active: bool
    model_config = {"from_attributes": True}

# Settings (key-value map)
class SettingsUpdate(BaseModel):
    values: dict

# Backup
class BackupData(BaseModel):
    properties: List[dict]
    reservations: List[dict]
    transactions: List[dict]
    cleaning_tasks: List[dict]
    message_templates: List[dict]
    ota_channels: List[dict]
    settings: dict
