from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, CharacterRelationship, Character
from ..schemas import RelationshipCreate, RelationshipOut

router = APIRouter(prefix="/novels/{novel_id}/relationships", tags=["relationships"])


@router.get("", response_model=List[RelationshipOut])
def list_relationships(novel_id: int, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    char_ids = [c.id for c in db.query(Character).filter(Character.novel_id == novel_id).all()]
    return db.query(CharacterRelationship).filter(
        (CharacterRelationship.character_a_id.in_(char_ids)) |
        (CharacterRelationship.character_b_id.in_(char_ids))
    ).all()


@router.post("", response_model=RelationshipOut)
def create_relationship(novel_id: int, data: RelationshipCreate, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    # Validate characters belong to this novel
    for cid in [data.character_a_id, data.character_b_id]:
        char = db.query(Character).filter(Character.id == cid, Character.novel_id == novel_id).first()
        if not char:
            raise HTTPException(400, f"Character {cid} not found in this novel")
    rel = CharacterRelationship(**data.model_dump())
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel


@router.delete("/{rel_id}")
def delete_relationship(novel_id: int, rel_id: int, db: Session = Depends(get_db)):
    rel = db.query(CharacterRelationship).filter(CharacterRelationship.id == rel_id).first()
    if not rel:
        raise HTTPException(404, "Relationship not found")
    db.delete(rel)
    db.commit()
    return {"ok": True}
