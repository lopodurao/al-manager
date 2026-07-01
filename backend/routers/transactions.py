from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
import uuid

router = APIRouter(prefix="/api/transactions", tags=["transactions"])
Auth = Depends(auth.get_current_user)

@router.get("", response_model=List[schemas.TransactionOut])
def list_transactions(
    prop_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    month: Optional[str] = Query(None),
    db: Session = Depends(get_db), _=Auth
):
    q = db.query(models.Transaction)
    if prop_id: q = q.filter(models.Transaction.prop_id == prop_id)
    if type:    q = q.filter(models.Transaction.type == type)
    if month:   q = q.filter(models.Transaction.date.startswith(month))
    return q.order_by(models.Transaction.date.desc()).all()

@router.post("", response_model=schemas.TransactionOut, status_code=201)
def create_transaction(data: schemas.TransactionCreate, db: Session = Depends(get_db), _=Auth):
    t = models.Transaction(id=str(uuid.uuid4()), **data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return t

@router.delete("/{tid}", status_code=204)
def delete_transaction(tid: str, db: Session = Depends(get_db), _=Auth):
    t = db.query(models.Transaction).filter(models.Transaction.id == tid).first()
    if not t: raise HTTPException(404)
    db.delete(t); db.commit()
