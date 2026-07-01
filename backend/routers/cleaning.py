from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas, auth
from ..database import get_db
import uuid

router = APIRouter(prefix="/api/cleaning", tags=["cleaning"])
Auth = Depends(auth.get_current_user)

@router.get("", response_model=List[schemas.CleaningTaskOut])
def list_tasks(
    prop_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db), _=Auth
):
    q = db.query(models.CleaningTask)
    if prop_id: q = q.filter(models.CleaningTask.prop_id == prop_id)
    if status:  q = q.filter(models.CleaningTask.status == status)
    return q.order_by(models.CleaningTask.date).all()

@router.post("", response_model=schemas.CleaningTaskOut, status_code=201)
def create_task(data: schemas.CleaningTaskCreate, db: Session = Depends(get_db), _=Auth):
    t = models.CleaningTask(id=str(uuid.uuid4()), **data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return t

@router.put("/{tid}", response_model=schemas.CleaningTaskOut)
def update_task(tid: str, data: schemas.CleaningTaskCreate, db: Session = Depends(get_db), _=Auth):
    t = db.query(models.CleaningTask).filter(models.CleaningTask.id == tid).first()
    if not t: raise HTTPException(404)
    for k, v in data.model_dump().items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t

@router.patch("/{tid}/toggle", response_model=schemas.CleaningTaskOut)
def toggle_task(tid: str, db: Session = Depends(get_db), _=Auth):
    t = db.query(models.CleaningTask).filter(models.CleaningTask.id == tid).first()
    if not t: raise HTTPException(404)
    t.status = "done" if t.status == "pending" else "pending"
    db.commit(); db.refresh(t)
    return t

@router.delete("/{tid}", status_code=204)
def delete_task(tid: str, db: Session = Depends(get_db), _=Auth):
    t = db.query(models.CleaningTask).filter(models.CleaningTask.id == tid).first()
    if not t: raise HTTPException(404)
    db.delete(t); db.commit()

@router.delete("", status_code=204)
def clear_done(db: Session = Depends(get_db), _=Auth):
    db.query(models.CleaningTask).filter(models.CleaningTask.status == "done").delete()
    db.commit()
