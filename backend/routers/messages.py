from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db
import uuid

router = APIRouter(prefix="/api/messages", tags=["messages"])
Auth = Depends(auth.get_current_user)

@router.get("", response_model=List[schemas.MessageTemplateOut])
def list_messages(db: Session = Depends(get_db), _=Auth):
    return db.query(models.MessageTemplate).order_by(models.MessageTemplate.name).all()

@router.post("", response_model=schemas.MessageTemplateOut, status_code=201)
def create_message(data: schemas.MessageTemplateCreate, db: Session = Depends(get_db), _=Auth):
    m = models.MessageTemplate(id=str(uuid.uuid4()), **data.model_dump())
    db.add(m); db.commit(); db.refresh(m)
    return m

@router.put("/{mid}", response_model=schemas.MessageTemplateOut)
def update_message(mid: str, data: schemas.MessageTemplateCreate, db: Session = Depends(get_db), _=Auth):
    m = db.query(models.MessageTemplate).filter(models.MessageTemplate.id == mid).first()
    if not m: raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return m

@router.patch("/{mid}/toggle", response_model=schemas.MessageTemplateOut)
def toggle_message(mid: str, db: Session = Depends(get_db), _=Auth):
    m = db.query(models.MessageTemplate).filter(models.MessageTemplate.id == mid).first()
    if not m: raise HTTPException(404)
    m.active = not m.active
    db.commit(); db.refresh(m)
    return m

@router.delete("/{mid}", status_code=204)
def delete_message(mid: str, db: Session = Depends(get_db), _=Auth):
    m = db.query(models.MessageTemplate).filter(models.MessageTemplate.id == mid).first()
    if not m: raise HTTPException(404)
    db.delete(m); db.commit()
