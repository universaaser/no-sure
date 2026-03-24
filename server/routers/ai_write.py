import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Novel, AIConfig, Chapter
from ..schemas import AIWriteRequest, AIWriteResponse
from ..context import build_writing_context, count_words

router = APIRouter(prefix="/novels/{novel_id}/ai-write", tags=["ai-write"])


@router.post("", response_model=AIWriteResponse)
async def ai_write(novel_id: int, data: AIWriteRequest, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")

    # Get AI config
    config = db.query(AIConfig).filter(AIConfig.novel_id == novel_id).first()
    if not config or not config.api_key:
        return AIWriteResponse(success=False, error="请先在设置中配置 AI API Key")

    # Build context
    context = build_writing_context(
        db=db,
        novel_id=novel_id,
        outline_node_id=data.outline_node_id,
        chapter_id=data.chapter_id,
        include_character_ids=data.include_characters,
        include_plot_thread_ids=data.include_plot_threads,
        include_world_element_ids=data.include_world_elements,
        prev_chapter_count=data.prev_chapter_count,
        custom_context=data.custom_context,
    )

    # Build system prompt
    system_prompt = config.system_prompt or "你是一位才华横溢的小说家，擅长创作引人入胜的故事。请根据提供的大纲和上下文信息，撰写小说章节内容。保持风格一致，人物性格鲜明，情节连贯。"
    system_prompt += f"\n\n{context}"

    # Build user prompt
    user_prompt = data.prompt or "请根据以上大纲和上下文，撰写这一章节的内容。"

    # Call AI API
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                config.api_url,
                headers={
                    "Authorization": f"Bearer {config.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": config.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens,
                },
            )
            response.raise_for_status()
            result = response.json()

        content = result["choices"][0]["message"]["content"]

        # If chapter_id provided, save the content
        if data.chapter_id:
            chapter = db.query(Chapter).filter(Chapter.id == data.chapter_id, Chapter.novel_id == novel_id).first()
            if chapter:
                chapter.content = content
                chapter.word_count = count_words(content)
                db.commit()

        return AIWriteResponse(
            success=True,
            content=content,
            context_used=context,
        )

    except httpx.HTTPStatusError as e:
        error_detail = ""
        try:
            error_detail = e.response.json()
        except Exception:
            error_detail = e.response.text
        return AIWriteResponse(success=False, error=f"API 请求失败 ({e.response.status_code}): {error_detail}")
    except httpx.TimeoutException:
        return AIWriteResponse(success=False, error="AI 请求超时，请稍后重试")
    except Exception as e:
        return AIWriteResponse(success=False, error=f"未知错误: {str(e)}")


@router.post("/preview-context")
def preview_context(novel_id: int, data: AIWriteRequest, db: Session = Depends(get_db)):
    """Preview what context will be sent to AI without actually calling the API."""
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")

    context = build_writing_context(
        db=db,
        novel_id=novel_id,
        outline_node_id=data.outline_node_id,
        chapter_id=data.chapter_id,
        include_character_ids=data.include_characters,
        include_plot_thread_ids=data.include_plot_threads,
        include_world_element_ids=data.include_world_elements,
        prev_chapter_count=data.prev_chapter_count,
        custom_context=data.custom_context,
    )

    return {"context": context, "char_count": len(context)}
