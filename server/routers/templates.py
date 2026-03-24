from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Novel, PromptTemplate
from ..schemas import PromptTemplateCreate, PromptTemplateUpdate, PromptTemplateOut

router = APIRouter(prefix="/novels/{novel_id}/templates", tags=["templates"])

# Built-in templates
BUILTIN_TEMPLATES = [
    {
        "name": "战斗场景",
        "description": "侧重动作描写、节奏感、力量碰撞",
        "category": "battle",
        "prompt_template": "请写一场精彩的战斗场景。要求：\n1. 动作描写要具体有力，避免空洞的形容词\n2. 节奏紧凑，短句与长句交替使用\n3. 体现角色的战斗风格和性格特点\n4. 加入环境互动（地形、天气等）\n5. 结尾留有悬念或转折",
    },
    {
        "name": "对话场景",
        "description": "侧重人物互动、推动剧情、展现性格",
        "category": "dialogue",
        "prompt_template": "请写一段精彩的对话场景。要求：\n1. 每个角色的说话风格要鲜明区分\n2. 对话要推动剧情发展，不能纯闲聊\n3. 加入动作、表情、心理描写作为对话标签\n4. 适当使用潜台词和言外之意\n5. 对话节奏有张有弛",
    },
    {
        "name": "环境描写",
        "description": "侧重氛围渲染、感官细节、情景交融",
        "category": "description",
        "prompt_template": "请写一段细腻的环境描写。要求：\n1. 调动五感（视觉、听觉、嗅觉、触觉、味觉）\n2. 环境描写要烘托当前的情绪氛围\n3. 动静结合，不要纯静态描写\n4. 使用比喻和通感手法\n5. 与角色的心境产生呼应",
    },
    {
        "name": "回忆闪回",
        "description": "侧重情感、与现实的呼应、时间过渡",
        "category": "flashback",
        "prompt_template": "请写一段回忆闪回场景。要求：\n1. 自然过渡到回忆（通过感官触发、物件触发等）\n2. 回忆内容要简洁有力，不要流水账\n3. 回忆与当前情节形成对比或呼应\n4. 自然回到现实，带回情感变化\n5. 控制回忆长度，不超过全文三分之一",
    },
    {
        "name": "章节过渡",
        "description": "承上启下、设置悬念、节奏转换",
        "category": "transition",
        "prompt_template": "请写一段章节过渡/衔接内容。要求：\n1. 简要回顾上文关键事件\n2. 自然引入新的场景或时间点\n3. 在结尾设置悬念或钩子\n4. 控制在300-500字\n5. 保持叙事节奏的连贯性",
    },
    {
        "name": "情感高潮",
        "description": "侧重内心独白、情感爆发、读者共鸣",
        "category": "emotion",
        "prompt_template": "请写一段情感高潮场景。要求：\n1. 深入角色的内心世界\n2. 情感递进，从压抑到爆发\n3. 使用细节和意象承载情感\n4. 避免直接说"他很伤心"，用行为和环境表现\n5. 给读者留下回味的空间",
    },
]


@router.get("", response_model=List[PromptTemplateOut])
def list_templates(novel_id: int, category: str = None, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")

    q = db.query(PromptTemplate).filter(PromptTemplate.novel_id == novel_id)
    if category:
        q = q.filter(PromptTemplate.category == category)
    custom = q.order_by(PromptTemplate.sort_order, PromptTemplate.id).all()

    # Merge with builtins (builtins are virtual, not in DB)
    result = []
    for bt in BUILTIN_TEMPLATES:
        if not category or bt["category"] == category:
            result.append(PromptTemplateOut(
                id=-(BUILTIN_TEMPLATES.index(bt) + 1),  # Negative ID for builtins
                novel_id=novel_id,
                name=bt["name"],
                description=bt["description"],
                category=bt["category"],
                prompt_template=bt["prompt_template"],
                is_builtin=True,
                sort_order=0,
                created_at=novel.created_at,
            ))
    result.extend(custom)
    return result


@router.post("", response_model=PromptTemplateOut)
def create_template(novel_id: int, data: PromptTemplateCreate, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")
    tpl = PromptTemplate(novel_id=novel_id, **data.model_dump())
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.put("/{tpl_id}", response_model=PromptTemplateOut)
def update_template(novel_id: int, tpl_id: int, data: PromptTemplateUpdate, db: Session = Depends(get_db)):
    if tpl_id < 0:
        raise HTTPException(400, "内置模板不可修改，请创建副本")
    tpl = db.query(PromptTemplate).filter(PromptTemplate.id == tpl_id, PromptTemplate.novel_id == novel_id).first()
    if not tpl:
        raise HTTPException(404, "Template not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(tpl, k, v)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{tpl_id}")
def delete_template(novel_id: int, tpl_id: int, db: Session = Depends(get_db)):
    if tpl_id < 0:
        raise HTTPException(400, "内置模板不可删除")
    tpl = db.query(PromptTemplate).filter(PromptTemplate.id == tpl_id, PromptTemplate.novel_id == novel_id).first()
    if not tpl:
        raise HTTPException(404, "Template not found")
    db.delete(tpl)
    db.commit()
    return {"ok": True}
