from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, PlotThread
from ..schemas import PlotThreadCreate, PlotThreadUpdate, PlotThreadOut

router = APIRouter(prefix="/novels/{novel_id}/plots", tags=["plots"])


@router.get("", response_model=List[PlotThreadOut])
def list_plot_threads(novel_id: int, status: str = None, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    q = db.query(PlotThread).filter(PlotThread.novel_id == novel_id)
    if status:
        q = q.filter(PlotThread.status == status)
    return q.order_by(PlotThread.id).all()


@router.post("", response_model=PlotThreadOut)
def create_plot_thread(novel_id: int, data: PlotThreadCreate, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    thread = PlotThread(novel_id=novel_id, **data.model_dump())
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


@router.put("/{thread_id}", response_model=PlotThreadOut)
def update_plot_thread(novel_id: int, thread_id: int, data: PlotThreadUpdate, db: Session = Depends(get_db)):
    thread = db.query(PlotThread).filter(PlotThread.id == thread_id, PlotThread.novel_id == novel_id).first()
    if not thread:
        raise HTTPException(404, "Plot thread not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(thread, k, v)
    db.commit()
    db.refresh(thread)
    return thread


@router.delete("/{thread_id}")
def delete_plot_thread(novel_id: int, thread_id: int, db: Session = Depends(get_db)):
    thread = db.query(PlotThread).filter(PlotThread.id == thread_id, PlotThread.novel_id == novel_id).first()
    if not thread:
        raise HTTPException(404, "Plot thread not found")
    db.delete(thread)
    db.commit()
    return {"ok": True}
