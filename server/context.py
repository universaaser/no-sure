"""
Smart context assembly for AI novel writing.
Gathers relevant story elements and formats them into a structured prompt.
"""
from sqlalchemy.orm import Session
from .models import Novel, Character, CharacterRelationship, WorldElement, OutlineNode, PlotThread, Chapter, AIConfig


def build_writing_context(
    db: Session,
    novel_id: int,
    outline_node_id: int = None,
    chapter_id: int = None,
    include_character_ids: list = None,
    include_plot_thread_ids: list = None,
    include_world_element_ids: list = None,
    prev_chapter_count: int = 2,
    custom_context: str = "",
) -> str:
    """Assemble all relevant context for AI writing."""
    sections = []

    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        return ""

    # ─── Novel Overview ───
    overview = f"## 小说信息\n"
    overview += f"- 书名：{novel.title}\n"
    if novel.genre:
        overview += f"- 类型：{novel.genre}\n"
    if novel.synopsis:
        overview += f"- 简介：{novel.synopsis}\n"
    sections.append(overview)

    # ─── Current Chapter Outline ───
    target_node = None
    if outline_node_id:
        target_node = db.query(OutlineNode).filter(OutlineNode.id == outline_node_id).first()
    elif chapter_id:
        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if chapter and chapter.outline_node_id:
            target_node = db.query(OutlineNode).filter(OutlineNode.id == chapter.outline_node_id).first()

    if target_node:
        outline_section = f"\n## 当前章节大纲\n"
        outline_section += f"- 标题：{target_node.title}\n"
        if target_node.summary:
            outline_section += f"- 摘要：{target_node.summary}\n"
        if target_node.notes:
            outline_section += f"- 备注：{target_node.notes}\n"

        # Include parent context (volume/arc)
        if target_node.parent_id:
            parent = db.query(OutlineNode).filter(OutlineNode.id == target_node.parent_id).first()
            if parent:
                outline_section += f"- 所属篇章：{parent.title}"
                if parent.summary:
                    outline_section += f" — {parent.summary}"
                outline_section += "\n"

        sections.append(outline_section)

    # ─── Characters ───
    char_ids = set(include_character_ids or [])

    # Auto-detect characters from plot threads and outline
    if not char_ids and target_node:
        # Get characters from related plot threads
        active_threads = db.query(PlotThread).filter(
            PlotThread.novel_id == novel_id,
            PlotThread.status.in_(["setup", "developing", "climax"])
        ).all()
        for t in active_threads:
            if t.related_character_ids:
                char_ids.update(t.related_character_ids)

    # Always include protagonists
    if not char_ids:
        protagonists = db.query(Character).filter(
            Character.novel_id == novel_id,
            Character.role.in_(["protagonist", "antagonist"])
        ).all()
        char_ids.update(c.id for c in protagonists)

    if char_ids:
        characters = db.query(Character).filter(
            Character.id.in_(char_ids),
            Character.novel_id == novel_id
        ).all()

        if characters:
            char_section = "\n## 角色信息\n"
            for c in characters:
                char_section += f"\n### {c.name}（{c.role}）\n"
                if c.description:
                    char_section += f"- 描述：{c.description}\n"
                if c.personality:
                    char_section += f"- 性格：{c.personality}\n"
                if c.appearance:
                    char_section += f"- 外貌：{c.appearance}\n"
                if c.background:
                    char_section += f"- 背景：{c.background}\n"
                if c.goals:
                    char_section += f"- 目标：{c.goals}\n"
                if c.speech_style:
                    char_section += f"- 说话风格：{c.speech_style}\n"
                if c.arc_summary:
                    char_section += f"- 角色弧线：{c.arc_summary}\n"

                # Get relationships
                rels = db.query(CharacterRelationship).filter(
                    (CharacterRelationship.character_a_id == c.id) |
                    (CharacterRelationship.character_b_id == c.id)
                ).all()
                if rels:
                    char_section += "- 关系："
                    rel_strs = []
                    for r in rels:
                        other_id = r.character_b_id if r.character_a_id == c.id else r.character_a_id
                        other = db.query(Character).filter(Character.id == other_id).first()
                        if other:
                            rel_strs.append(f"与{other.name}（{r.relationship_type}）{r.description}".strip())
                    char_section += "；".join(rel_strs) + "\n"

            sections.append(char_section)

    # ─── Plot Threads ───
    thread_ids = set(include_plot_thread_ids or [])
    if not thread_ids:
        active_threads = db.query(PlotThread).filter(
            PlotThread.novel_id == novel_id,
            PlotThread.status.in_(["setup", "developing", "climax"])
        ).all()
        thread_ids.update(t.id for t in active_threads)

    if thread_ids:
        threads = db.query(PlotThread).filter(
            PlotThread.id.in_(thread_ids),
            PlotThread.novel_id == novel_id
        ).all()

        if threads:
            plot_section = "\n## 活跃剧情线\n"
            for t in threads:
                status_map = {"setup": "铺垫", "developing": "发展中", "climax": "高潮", "resolved": "已解决", "abandoned": "已放弃"}
                plot_section += f"\n### {t.title}（{status_map.get(t.status, t.status)}）\n"
                if t.description:
                    plot_section += f"- 描述：{t.description}\n"
                if t.resolution_notes:
                    plot_section += f"- 解决方向：{t.resolution_notes}\n"
            sections.append(plot_section)

    # ─── World Elements ───
    world_ids = set(include_world_element_ids or [])
    if world_ids:
        elements = db.query(WorldElement).filter(
            WorldElement.id.in_(world_ids),
            WorldElement.novel_id == novel_id
        ).all()

        if elements:
            world_section = "\n## 世界观设定\n"
            category_map = {
                "location": "地点", "organization": "组织", "rule": "规则",
                "history": "历史", "item": "物品", "culture": "文化",
                "magic_system": "魔法体系", "technology": "科技"
            }
            for e in elements:
                cat = category_map.get(e.category, e.category)
                world_section += f"\n### [{cat}] {e.name}\n"
                if e.description:
                    world_section += f"{e.description}\n"
                if e.details:
                    for k, v in e.details.items():
                        world_section += f"- {k}：{v}\n"
            sections.append(world_section)

    # ─── Previous Chapters Summary ───
    if prev_chapter_count > 0:
        prev_chapters = db.query(Chapter).filter(
            Chapter.novel_id == novel_id,
            Chapter.content != ""
        ).order_by(Chapter.id.desc()).limit(prev_chapter_count + 1).all()

        # Exclude current chapter if it exists
        if chapter_id:
            prev_chapters = [ch for ch in prev_chapters if ch.id != chapter_id]

        if prev_chapters:
            prev_chapters.reverse()  # chronological order
            prev_section = "\n## 前文回顾\n"
            for ch in prev_chapters[-prev_chapter_count:]:
                prev_section += f"\n### {ch.title or f'第{ch.id}章'}\n"
                # Use first 200 chars as summary
                if ch.content:
                    summary = ch.content[:300].replace("\n", " ")
                    if len(ch.content) > 300:
                        summary += "..."
                    prev_section += f"- 内容摘要：{summary}\n"
            sections.append(prev_section)

    # ─── Custom Context ───
    if custom_context:
        sections.append(f"\n## 补充说明\n{custom_context}\n")

    return "\n".join(sections)


def count_words(text: str) -> int:
    """Count words in Chinese/English mixed text."""
    if not text:
        return 0
    count = 0
    for char in text:
        if '\u4e00' <= char <= '\u9fff':
            count += 1
    # Count English words
    import re
    english_words = re.findall(r'[a-zA-Z]+', text)
    count += len(english_words)
    return count
