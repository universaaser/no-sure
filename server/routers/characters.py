from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, Character
from ..schemas import CharacterCreate, CharacterUpdate, CharacterOut

router = APIRouter(prefix="/novels/{novel_id}/characters", tags=["characters"])


def _get_novel(novel_id: int, db: Session):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    return novel


@router.get("", response_model=List[CharacterOut])
def list_characters(novel_id: int, db: Session = Depends(get_db)):
    _get_novel(novel_id, db)
    return db.query(Character).filter(Character.novel_id == novel_id).order_by(Character.sort_order, Character.id).all()


@router.post("", response_model=CharacterOut)
def create_character(novel_id: int, data: CharacterCreate, db: Session = Depends(get_db)):
    _get_novel(novel_id, db)
    char = Character(novel_id=novel_id, **data.model_dump())
    db.add(char)
    db.commit()
    db.refresh(char)
    return char


@router.get("/{char_id}", response_model=CharacterOut)
def get_character(novel_id: int, char_id: int, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == char_id, Character.novel_id == novel_id).first()
    if not char:
        raise HTTPException(404, "Character not found")
    return char


@router.put("/{char_id}", response_model=CharacterOut)
def update_character(novel_id: int, char_id: int, data: CharacterUpdate, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == char_id, Character.novel_id == novel_id).first()
    if not char:
        raise HTTPException(404, "Character not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(char, k, v)
    db.commit()
    db.refresh(char)
    return char


@router.delete("/{char_id}")
def delete_character(novel_id: int, char_id: int, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == char_id, Character.novel_id == novel_id).first()
    if not char:
        raise HTTPException(404, "Character not found")
    db.delete(char)
    db.commit()
    return {"ok": True}
