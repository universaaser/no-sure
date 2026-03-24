from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, Chapter
from ..schemas import ChapterCreate, ChapterUpdate, ChapterOut
from ..context import count_words

router = APIRouter(prefix="/novels/{novel_id}/chapters", tags=["chapters"])


@router.get("", response_model=List[ChapterOut])
def list_chapters(novel_id: int, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    return db.query(Chapter).filter(Chapter.novel_id == novel_id).order_by(Chapter.id).all()


@router.post("", response_model=ChapterOut)
def create_chapter(novel_id: int, data: ChapterCreate, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    chapter = Chapter(novel_id=novel_id, **data.model_dump())
    chapter.word_count = count_words(data.content)
    db.add(chapter)
    db.commit()
    db.refresh(chapter)
    return chapter


@router.get("/{chapter_id}", response_model=ChapterOut)
def get_chapter(novel_id: int, chapter_id: int, db: Session = Depends(get_db)):
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.novel_id == novel_id).first()
    if not chapter:
        raise HTTPException(404, "Chapter not found")
    return chapter


@router.put("/{chapter_id}", response_model=ChapterOut)
def update_chapter(novel_id: int, chapter_id: int, data: ChapterUpdate, db: Session = Depends(get_db)):
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.novel_id == novel_id).first()
    if not chapter:
        raise HTTPException(404, "Chapter not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(chapter, k, v)
    if "content" in data.model_dump(exclude_unset=True):
        chapter.word_count = count_words(data.content)
    db.commit()
    db.refresh(chapter)
    return chapter


@router.delete("/{chapter_id}")
def delete_chapter(novel_id: int, chapter_id: int, db: Session = Depends(get_db)):
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.novel_id == novel_id).first()
    if not chapter:
        raise HTTPException(404, "Chapter not found")
    db.delete(chapter)
    db.commit()
    return {"ok": True}
