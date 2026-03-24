from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, WorldElement
from ..schemas import WorldElementCreate, WorldElementUpdate, WorldElementOut

router = APIRouter(prefix="/novels/{novel_id}/world", tags=["world"])


@router.get("", response_model=List[WorldElementOut])
def list_world_elements(novel_id: int, category: str = None, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    q = db.query(WorldElement).filter(WorldElement.novel_id == novel_id)
    if category:
        q = q.filter(WorldElement.category == category)
    return q.order_by(WorldElement.sort_order, WorldElement.id).all()


@router.post("", response_model=WorldElementOut)
def create_world_element(novel_id: int, data: WorldElementCreate, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    elem = WorldElement(novel_id=novel_id, **data.model_dump())
    db.add(elem)
    db.commit()
    db.refresh(elem)
    return elem


@router.put("/{elem_id}", response_model=WorldElementOut)
def update_world_element(novel_id: int, elem_id: int, data: WorldElementUpdate, db: Session = Depends(get_db)):
    elem = db.query(WorldElement).filter(WorldElement.id == elem_id, WorldElement.novel_id == novel_id).first()
    if not elem:
        raise HTTPException(404, "World element not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(elem, k, v)
    db.commit()
    db.refresh(elem)
    return elem


@router.delete("/{elem_id}")
def delete_world_element(novel_id: int, elem_id: int, db: Session = Depends(get_db)):
    elem = db.query(WorldElement).filter(WorldElement.id == elem_id, WorldElement.novel_id == novel_id).first()
    if not elem:
        raise HTTPException(404, "World element not found")
    db.delete(elem)
    db.commit()
    return {"ok": True}
