import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Novel, Chapter, Character, WorldElement, PlotThread, AIConfig, Foreshadow
from ..schemas import ConsistencyCheckResponse, ConsistencyIssue

router = APIRouter(prefix="/novels/{novel_id}/consistency-check", tags=["consistency"])


@router.post("", response_model=ConsistencyCheckResponse)
async def consistency_check(novel_id: int, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")

    config = db.query(AIConfig).filter(AIConfig.novel_id == novel_id).first()
    if not config or not config.api_key:
        return ConsistencyCheckResponse(success=False, error="请先在设置中配置 AI API Key")

    # Gather all data
    chapters = db.query(Chapter).filter(Chapter.novel_id == novel_id, Chapter.content != "").order_by(Chapter.id).all()
    if len(chapters) < 2:
        return ConsistencyCheckResponse(success=False, error="至少需要 2 个有内容的章节才能检查")

    characters = db.query(Character).filter(Character.novel_id == novel_id).all()
    world_elements = db.query(WorldElement).filter(WorldElement.novel_id == novel_id).all()
    foreshadows = db.query(Foreshadow).filter(
        Foreshadow.novel_id == novel_id,
        Foreshadow.status.in_(["planted", "partially_revealed"])
    ).all()

    # Build check prompt
    check_prompt = f"""请检查以下小说内容的一致性问题。找出所有矛盾、不一致或可能被遗忘的伏笔。

## 小说：{novel.title}

### 角色设定
"""
    for c in characters:
        check_prompt += f"- {c.name}（{c.role}）：{c.description or c.personality or '无描述'}\n"
        if c.appearance:
            check_prompt += f"  外貌：{c.appearance}\n"
        if c.background:
            check_prompt += f"  背景：{c.background}\n"

    check_prompt += "\n### 世界观设定\n"
    for e in world_elements:
        check_prompt += f"- [{e.category}] {e.name}：{e.description or '无描述'}\n"

    check_prompt += "\n### 未收伏笔\n"
    for f in foreshadows:
        check_prompt += f"- {f.title}：{f.planted_detail or f.description}\n"

    check_prompt += "\n### 章节内容\n"
    for ch in chapters:
        # Send first 800 chars of each chapter for context
        content_preview = ch.content[:800] if ch.content else ""
        if len(ch.content or "") > 800:
            content_preview += "..."
        check_prompt += f"\n--- {ch.title or f'第{ch.id}章'} ---\n{content_preview}\n"

    check_prompt += """

请按以下 JSON 格式返回检查结果（不要包含其他文字）：
```json
{
  "summary": "总体评价",
  "issues": [
    {
      "category": "角色矛盾|设定矛盾|时间线|伏笔遗忘|逻辑问题",
      "description": "具体问题描述",
      "chapter_refs": ["涉及的第X章"],
      "severity": "error|warning|info"
    }
  ]
}
```"""

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
                        {"role": "system", "content": "你是一位专业的小说编辑，擅长发现故事中的逻辑矛盾、角色不一致和被遗忘的伏笔。请严格按要求的 JSON 格式返回结果。"},
                        {"role": "user", "content": check_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": config.max_tokens,
                },
            )
            response.raise_for_status()
            result = response.json()

        content = result["choices"][0]["message"]["content"]

        # Parse JSON from response
        import json
        import re
        json_match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
        if json_match:
            data = json.loads(json_match.group(1))
        else:
            # Try parsing directly
            data = json.loads(content)

        issues = []
        for issue in data.get("issues", []):
            issues.append(ConsistencyIssue(
                category=issue.get("category", ""),
                description=issue.get("description", ""),
                chapter_refs=issue.get("chapter_refs", []),
                severity=issue.get("severity", "warning"),
            ))

        return ConsistencyCheckResponse(
            success=True,
            issues=issues,
            summary=data.get("summary", ""),
        )

    except httpx.HTTPStatusError as e:
        return ConsistencyCheckResponse(success=False, error=f"API 请求失败 ({e.response.status_code})")
    except Exception as e:
        return ConsistencyCheckResponse(success=False, error=f"错误: {str(e)}")
