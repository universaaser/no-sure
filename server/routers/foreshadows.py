from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, Foreshadow
from ..schemas import ForeshadowCreate, ForeshadowUpdate, ForeshadowOut

router = APIRouter(prefix="/novels/{novel_id}/foreshadows", tags=["foreshadows"])


@router.get("", response_model=List[ForeshadowOut])
def list_foreshadows(novel_id: int, status: str = None, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    q = db.query(Foreshadow).filter(Foreshadow.novel_id == novel_id)
    if status:
        q = q.filter(Foreshadow.status == status)
    return q.order_by(Foreshadow.priority.desc(), Foreshadow.id).all()


@router.post("", response_model=ForeshadowOut)
def create_foreshadow(novel_id: int, data: ForeshadowCreate, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    fs = Foreshadow(novel_id=novel_id, **data.model_dump())
    db.add(fs)
    db.commit()
    db.refresh(fs)
    return fs


@router.put("/{fs_id}", response_model=ForeshadowOut)
def update_foreshadow(novel_id: int, fs_id: int, data: ForeshadowUpdate, db: Session = Depends(get_db)):
    fs = db.query(Foreshadow).filter(Foreshadow.id == fs_id, Foreshadow.novel_id == novel_id).first()
    if not fs:
        raise HTTPException(404, "Foreshadow not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(fs, k, v)
    db.commit()
    db.refresh(fs)
    return fs


@router.delete("/{fs_id}")
def delete_foreshadow(novel_id: int, fs_id: int, db: Session = Depends(get_db)):
    fs = db.query(Foreshadow).filter(Foreshadow.id == fs_id, Foreshadow.novel_id == novel_id).first()
    if not fs:
        raise HTTPException(404, "Foreshadow not found")
    db.delete(fs)
    db.commit()
    return {"ok": True}
