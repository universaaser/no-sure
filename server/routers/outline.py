from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, OutlineNode
from ..schemas import OutlineNodeCreate, OutlineNodeUpdate, OutlineNodeOut

router = APIRouter(prefix="/novels/{novel_id}/outline", tags=["outline"])


@router.get("", response_model=List[OutlineNodeOut])
def list_outline(novel_id: int, parent_id: int = None, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    q = db.query(OutlineNode).filter(OutlineNode.novel_id == novel_id)
    if parent_id is not None:
        q = q.filter(OutlineNode.parent_id == parent_id)
    else:
        q = q.filter(OutlineNode.parent_id.is_(None))
    return q.order_by(OutlineNode.sort_order, OutlineNode.id).all()


@router.get("/tree", response_model=List[OutlineNodeOut])
def get_outline_tree(novel_id: int, db: Session = Depends(get_db)):
    """Get all outline nodes in flat list (frontend builds tree)."""
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    return db.query(OutlineNode).filter(OutlineNode.novel_id == novel_id).order_by(OutlineNode.sort_order, OutlineNode.id).all()


@router.post("", response_model=OutlineNodeOut)
def create_outline_node(novel_id: int, data: OutlineNodeCreate, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    node = OutlineNode(novel_id=novel_id, **data.model_dump())
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.put("/{node_id}", response_model=OutlineNodeOut)
def update_outline_node(novel_id: int, node_id: int, data: OutlineNodeUpdate, db: Session = Depends(get_db)):
    node = db.query(OutlineNode).filter(OutlineNode.id == node_id, OutlineNode.novel_id == novel_id).first()
    if not node:
        raise HTTPException(404, "Outline node not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(node, k, v)
    db.commit()
    db.refresh(node)
    return node


@router.delete("/{node_id}")
def delete_outline_node(novel_id: int, node_id: int, db: Session = Depends(get_db)):
    node = db.query(OutlineNode).filter(OutlineNode.id == node_id, OutlineNode.novel_id == novel_id).first()
    if not node:
        raise HTTPException(404, "Outline node not found")
    db.delete(node)
    db.commit()
    return {"ok": True}
