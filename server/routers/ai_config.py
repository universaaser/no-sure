from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Novel, AIConfig
from ..schemas import AIConfigCreate, AIConfigUpdate, AIConfigOut

router = APIRouter(prefix="/novels/{novel_id}/ai-config", tags=["ai-config"])


@router.get("", response_model=AIConfigOut)
def get_ai_config(novel_id: int, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    config = db.query(AIConfig).filter(AIConfig.novel_id == novel_id).first()
    if not config:
        # Return defaults
        return AIConfigOut(
            id=0, novel_id=novel_id,
            provider="openai",
            api_url="https://api.openai.com/v1/chat/completions",
            model="gpt-4o-mini",
            system_prompt="",
            temperature=0.7,
            max_tokens=4000,
            context_strategy="auto"
        )
    return config


@router.put("", response_model=AIConfigOut)
def upsert_ai_config(novel_id: int, data: AIConfigCreate, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    config = db.query(AIConfig).filter(AIConfig.novel_id == novel_id).first()
    if not config:
        config = AIConfig(novel_id=novel_id, **data.model_dump())
        db.add(config)
    else:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(config, k, v)
    db.commit()
    db.refresh(config)
    return config
