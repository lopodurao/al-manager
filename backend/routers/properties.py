from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas, auth
from ..database import get_db
import uuid

router = APIRouter(prefix="/api/properties", tags=["properties"])
Auth = Depends(auth.get_current_user)

@router.get("", response_model=List[schemas.PropertyOut])
def list_properties(db: Session = Depends(get_db), _=Auth):
    return db.query(models.Property).order_by(models.Property.name).all()

@router.post("", response_model=schemas.PropertyOut, status_code=201)
def create_property(data: schemas.PropertyCreate, db: Session = Depends(get_db), _=Auth):
    p = models.Property(id=str(uuid.uuid4()), **data.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return p

@router.get("/{pid}", response_model=schemas.PropertyOut)
def get_property(pid: str, db: Session = Depends(get_db), _=Auth):
    p = db.query(models.Property).filter(models.Property.id == pid).first()
    if not p: raise HTTPException(404, "Propriedade não encontrada")
    return p

@router.put("/{pid}", response_model=schemas.PropertyOut)
def update_property(pid: str, data: schemas.PropertyCreate, db: Session = Depends(get_db), _=Auth):
    p = db.query(models.Property).filter(models.Property.id == pid).first()
    if not p: raise HTTPException(404, "Propriedade não encontrada")
    for k, v in data.model_dump().items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p

@router.delete("/{pid}", status_code=204)
def delete_property(pid: str, db: Session = Depends(get_db), _=Auth):
    p = db.query(models.Property).filter(models.Property.id == pid).first()
    if not p: raise HTTPException(404, "Propriedade não encontrada")
    db.delete(p); db.commit()
