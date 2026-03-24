from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, Chapter, ChapterVersion
from ..schemas import ChapterVersionOut
from ..context import count_words

router = APIRouter(prefix="/novels/{novel_id}/chapters/{chapter_id}/versions", tags=["versions"])


@router.get("", response_model=List[ChapterVersionOut])
def list_versions(novel_id: int, chapter_id: int, db: Session = Depends(get_db)):
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.novel_id == novel_id).first()
    if not chapter:
        raise HTTPException(404, "Chapter not found")
    return db.query(ChapterVersion).filter(
        ChapterVersion.chapter_id == chapter_id
    ).order_by(ChapterVersion.version_number.desc()).all()


@router.get("/{version_id}", response_model=ChapterVersionOut)
def get_version(novel_id: int, chapter_id: int, version_id: int, db: Session = Depends(get_db)):
    version = db.query(ChapterVersion).filter(
        ChapterVersion.id == version_id,
        ChapterVersion.chapter_id == chapter_id
    ).first()
    if not version:
        raise HTTPException(404, "Version not found")
    return version


@router.post("/save", response_model=ChapterVersionOut)
def save_version(novel_id: int, chapter_id: int, change_summary: str = "", db: Session = Depends(get_db)):
    """Manually save a snapshot of the current chapter content."""
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.novel_id == novel_id).first()
    if not chapter:
        raise HTTPException(404, "Chapter not found")

    # Get next version number
    last_ver = db.query(ChapterVersion).filter(
        ChapterVersion.chapter_id == chapter_id
    ).order_by(ChapterVersion.version_number.desc()).first()
    next_num = (last_ver.version_number + 1) if last_ver else 1

    version = ChapterVersion(
        chapter_id=chapter_id,
        content=chapter.content,
        word_count=chapter.word_count,
        version_number=next_num,
        change_summary=change_summary,
    )
    db.add(version)
    chapter.version = next_num
    db.commit()
    db.refresh(version)
    return version


@router.post("/{version_id}/restore", response_model=ChapterVersionOut)
def restore_version(novel_id: int, chapter_id: int, version_id: int, db: Session = Depends(get_db)):
    """Restore chapter content to a specific version."""
    version = db.query(ChapterVersion).filter(
        ChapterVersion.id == version_id,
        ChapterVersion.chapter_id == chapter_id
    ).first()
    if not version:
        raise HTTPException(404, "Version not found")

    chapter = db.query(Chapter).filter(Chapter.id == chapter_id, Chapter.novel_id == novel_id).first()
    if not chapter:
        raise HTTPException(404, "Chapter not found")

    # Save current state as a new version before restoring
    last_ver = db.query(ChapterVersion).filter(
        ChapterVersion.chapter_id == chapter_id
    ).order_by(ChapterVersion.version_number.desc()).first()
    next_num = (last_ver.version_number + 1) if last_ver else 1

    snapshot = ChapterVersion(
        chapter_id=chapter_id,
        content=chapter.content,
        word_count=chapter.word_count,
        version_number=next_num,
        change_summary=f"自动备份：回滚到 v{version.version_number} 之前",
    )
    db.add(snapshot)

    # Restore
    chapter.content = version.content
    chapter.word_count = version.word_count
    chapter.version = next_num
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.delete("/{version_id}")
def delete_version(novel_id: int, chapter_id: int, version_id: int, db: Session = Depends(get_db)):
    version = db.query(ChapterVersion).filter(
        ChapterVersion.id == version_id,
        ChapterVersion.chapter_id == chapter_id
    ).first()
    if not version:
        raise HTTPException(404, "Version not found")
    db.delete(version)
    db.commit()
    return {"ok": True}
