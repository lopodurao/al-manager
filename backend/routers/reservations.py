from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
import uuid

router = APIRouter(prefix="/api/reservations", tags=["reservations"])
Auth = Depends(auth.get_current_user)

@router.get("", response_model=List[schemas.ReservationOut])
def list_reservations(
    prop_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db), _=Auth
):
    q = db.query(models.Reservation)
    if prop_id: q = q.filter(models.Reservation.prop_id == prop_id)
    if status:  q = q.filter(models.Reservation.status == status)
    return q.order_by(models.Reservation.checkin.desc()).all()

@router.post("", response_model=schemas.ReservationOut, status_code=201)
def create_reservation(data: schemas.ReservationCreate, db: Session = Depends(get_db), _=Auth):
    if not db.query(models.Property).filter(models.Property.id == data.prop_id).first():
        raise HTTPException(400, "Propriedade inválida")
    if data.checkout <= data.checkin:
        raise HTTPException(400, "Check-out deve ser depois do check-in")
    r = models.Reservation(id=str(uuid.uuid4()), **data.model_dump())
    db.add(r)
    # Auto-create transactions
    if data.price > 0:
        db.add(models.Transaction(
            id=str(uuid.uuid4()), prop_id=data.prop_id, res_id=r.id,
            date=data.checkin, type="income", category="Alojamento",
            amount=data.price, channel=data.channel,
            desc=f"Reserva {data.guest_name}"
        ))
        if data.commission > 0:
            channels = {"airbnb": "Airbnb", "booking": "Booking.com", "livvi": "Livvi", "direct": "Direto"}
            db.add(models.Transaction(
                id=str(uuid.uuid4()), prop_id=data.prop_id, res_id=r.id,
                date=data.checkin, type="expense", category="Comissão OTA",
                amount=data.commission, channel=data.channel,
                desc=f"Comissão {channels.get(data.channel, data.channel)}"
            ))
    # Auto-create cleaning task
    db.add(models.CleaningTask(
        id=str(uuid.uuid4()), prop_id=data.prop_id,
        type="limpeza", date=data.checkout, status="pending",
        priority="high", notes=f"Check-out {data.guest_name}"
    ))
    db.commit(); db.refresh(r)
    return r

@router.get("/{rid}", response_model=schemas.ReservationOut)
def get_reservation(rid: str, db: Session = Depends(get_db), _=Auth):
    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404, "Reserva não encontrada")
    return r

@router.put("/{rid}", response_model=schemas.ReservationOut)
def update_reservation(rid: str, data: schemas.ReservationUpdate, db: Session = Depends(get_db), _=Auth):
    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404, "Reserva não encontrada")
    for k, v in data.model_dump().items():
        setattr(r, k, v)
    db.commit(); db.refresh(r)
    return r

@router.patch("/{rid}/sef-reported", response_model=schemas.ReservationOut)
def mark_sef_reported(rid: str, db: Session = Depends(get_db), _=Auth):
    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404)
    r.sef_reported = True
    db.commit(); db.refresh(r)
    return r

@router.delete("/{rid}", status_code=204)
def delete_reservation(rid: str, db: Session = Depends(get_db), _=Auth):
    r = db.query(models.Reservation).filter(models.Reservation.id == rid).first()
    if not r: raise HTTPException(404)
    db.delete(r); db.commit()
