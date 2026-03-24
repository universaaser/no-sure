"""
Smart context assembly engine for AI novel writing.
Features:
  - Relevance scoring based on current chapter outline
  - Token budget control with automatic trimming
  - Multi-level summaries (full / brief / minimal)
  - Priority-based greedy selection
"""
import re
from sqlalchemy.orm import Session
from .models import (
    Novel, Character, CharacterRelationship, WorldElement,
    OutlineNode, PlotThread, Chapter, AIConfig, Foreshadow
)


# ─── Token estimation ───
def estimate_tokens(text: str) -> int:
    """Rough token count: ~1.5 per CJK char, ~0.75 per English word."""
    if not text:
        return 0
    cjk = sum(1 for c in text if '\u4e00' <= c <= '\u9fff' or '\u3000' <= c <= '\u303f')
    en_words = len(re.findall(r'[a-zA-Z]+', text))
    return int(cjk * 1.5 + en_words * 0.75 + len(text) * 0.05)


def count_words(text: str) -> int:
    if not text:
        return 0
    cjk = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    en_words = len(re.findall(r'[a-zA-Z]+', text))
    return cjk + en_words


# ─── Context Piece ───
class ContextPiece:
    """A unit of context with priority and multi-level content."""
    def __init__(self, category: str, title: str, full: str, brief: str = "", minimal: str = "", priority: int = 50):
        self.category = category
        self.title = title
        self.full = full
        self.brief = brief or title
        self.minimal = minimal or title
        self.priority = priority
        self.tokens_full = estimate_tokens(full)
        self.tokens_brief = estimate_tokens(brief)
        self.tokens_minimal = estimate_tokens(minimal)

    def render(self, level: str = "full") -> str:
        if level == "full":
            return self.full
        elif level == "brief":
            return self.brief
        return self.minimal

    def tokens(self, level: str = "full") -> int:
        if level == "full":
            return self.tokens_full
        elif level == "brief":
            return self.tokens_brief
        return self.tokens_minimal


def _extract_mentions(text: str) -> set:
    """Extract potential character/element name mentions from text."""
    if not text:
        return set()
    # Simple approach: find CJK name-like sequences (2-4 chars)
    mentions = set()
    for match in re.finditer(r'[\u4e00-\u9fff]{2,4}', text):
        mentions.add(match.group())
    return mentions


def _score_character(char: Character, mentions: set, is_protagonist: bool) -> int:
    """Score a character's relevance to the current context."""
    score = 20  # base
    if is_protagonist:
        score += 40
    if char.role == "antagonist":
        score += 30
    elif char.role == "supporting":
        score += 15
    if char.name in mentions:
        score += 50
    return min(score, 100)


def _score_world_element(elem: WorldElement, mentions: set) -> int:
    """Score a world element's relevance."""
    score = 15
    if elem.name in mentions:
        score += 40
    return min(score, 100)


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
    context_budget: int = 6000,
) -> str:
    """Assemble context within token budget, sorted by relevance."""
    pieces: list[ContextPiece] = []

    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        return ""

    # ─── Find target outline node ───
    target_node = None
    if outline_node_id:
        target_node = db.query(OutlineNode).filter(OutlineNode.id == outline_node_id).first()
    elif chapter_id:
        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if chapter and chapter.outline_node_id:
            target_node = db.query(OutlineNode).filter(OutlineNode.id == chapter.outline_node_id).first()

    # Extract mentions from outline for relevance scoring
    outline_text = ""
    if target_node:
        outline_text = f"{target_node.title} {target_node.summary} {target_node.notes}"
    mentions = _extract_mentions(outline_text)

    # ─── 1. Novel Overview (always include, highest priority) ───
    overview = f"## 小说信息\n- 书名：{novel.title}"
    if novel.genre:
        overview += f"\n- 类型：{novel.genre}"
    if novel.synopsis:
        overview += f"\n- 简介：{novel.synopsis}"
    pieces.append(ContextPiece("overview", "小说信息", overview, priority=100))

    # ─── 2. Current Chapter Outline (high priority) ───
    if target_node:
        section = f"\n## 当前章节大纲\n- 标题：{target_node.title}"
        if target_node.summary:
            section += f"\n- 摘要：{target_node.summary}"
        if target_node.notes:
            section += f"\n- 备注：{target_node.notes}"
        if target_node.parent_id:
            parent = db.query(OutlineNode).filter(OutlineNode.id == target_node.parent_id).first()
            if parent:
                section += f"\n- 所属篇章：{parent.title}"
                if parent.summary:
                    section += f" — {parent.summary}"
        pieces.append(ContextPiece("outline", "当前章节大纲", section, priority=95))

    # ─── 3. Characters ───
    char_ids = set(include_character_ids or [])
    if not char_ids:
        # Auto-detect from active plot threads
        active_threads = db.query(PlotThread).filter(
            PlotThread.novel_id == novel_id,
            PlotThread.status.in_(["setup", "developing", "climax"])
        ).all()
        for t in active_threads:
            if t.related_character_ids:
                char_ids.update(t.related_character_ids)
    if not char_ids:
        protagonists = db.query(Character).filter(
            Character.novel_id == novel_id,
            Character.role.in_(["protagonist", "antagonist"])
        ).all()
        char_ids.update(c.id for c in protagonists)

    if char_ids:
        characters = db.query(Character).filter(Character.id.in_(char_ids), Character.novel_id == novel_id).all()
        for c in characters:
            is_protagonist = c.role in ("protagonist", "antagonist")
            score = _score_character(c, mentions, is_protagonist)

            # Full version
            full = f"\n### {c.name}（{c.role}）\n"
            if c.description:
                full += f"- 描述：{c.description}\n"
            if c.personality:
                full += f"- 性格：{c.personality}\n"
            if c.appearance:
                full += f"- 外貌：{c.appearance}\n"
            if c.background:
                full += f"- 背景：{c.background}\n"
            if c.goals:
                full += f"- 目标：{c.goals}\n"
            if c.speech_style:
                full += f"- 说话风格：{c.speech_style}\n"
            if c.arc_summary:
                full += f"- 角色弧线：{c.arc_summary}\n"

            # Relationships
            rels = db.query(CharacterRelationship).filter(
                (CharacterRelationship.character_a_id == c.id) |
                (CharacterRelationship.character_b_id == c.id)
            ).all()
            if rels:
                rel_strs = []
                for r in rels:
                    other_id = r.character_b_id if r.character_a_id == c.id else r.character_a_id
                    other = db.query(Character).filter(Character.id == other_id).first()
                    if other:
                        rel_strs.append(f"与{other.name}（{r.relationship_type}）{r.description}".strip())
                if rel_strs:
                    full += f"- 关系：{'；'.join(rel_strs)}\n"

            # Brief version
            brief_parts = [f"{c.name}（{c.role}）"]
            if c.summary_brief:
                brief_parts.append(c.summary_brief)
            elif c.personality:
                brief_parts.append(c.personality[:50])
            brief = "，".join(brief_parts)

            pieces.append(ContextPiece("character", f"角色：{c.name}", full, brief=brief, priority=score))

    # ─── 4. Plot Threads ───
    thread_ids = set(include_plot_thread_ids or [])
    if not thread_ids:
        active_threads = db.query(PlotThread).filter(
            PlotThread.novel_id == novel_id,
            PlotThread.status.in_(["setup", "developing", "climax"])
        ).all()
        thread_ids.update(t.id for t in active_threads)

    if thread_ids:
        threads = db.query(PlotThread).filter(PlotThread.id.in_(thread_ids), PlotThread.novel_id == novel_id).all()
        status_map = {"setup": "铺垫", "developing": "发展中", "climax": "高潮", "resolved": "已解决", "abandoned": "已放弃"}
        for t in threads:
            score = 60 if t.status in ("developing", "climax") else 40
            if t.thread_type == "main":
                score += 20

            full = f"\n### {t.title}（{status_map.get(t.status, t.status)}）\n"
            if t.description:
                full += f"- 描述：{t.description}\n"
            if t.resolution_notes:
                full += f"- 解决方向：{t.resolution_notes}\n"

            brief = f"{t.title}（{status_map.get(t.status, t.status)}）"
            if t.description:
                brief += f"：{t.description[:80]}"

            pieces.append(ContextPiece("plot", f"剧情线：{t.title}", full, brief=brief, priority=min(score, 100)))

    # ─── 5. World Elements ───
    world_ids = set(include_world_element_ids or [])
    if world_ids:
        elements = db.query(WorldElement).filter(WorldElement.id.in_(world_ids), WorldElement.novel_id == novel_id).all()
        category_map = {
            "location": "地点", "organization": "组织", "rule": "规则",
            "history": "历史", "item": "物品", "culture": "文化",
            "magic_system": "魔法体系", "technology": "科技"
        }
        for e in elements:
            score = _score_world_element(e, mentions)
            cat = category_map.get(e.category, e.category)

            full = f"\n### [{cat}] {e.name}\n"
            if e.description:
                full += f"{e.description}\n"
            if e.details:
                for k, v in e.details.items():
                    full += f"- {k}：{v}\n"

            brief = f"[{cat}] {e.name}"
            if e.summary_brief:
                brief += f"：{e.summary_brief}"
            elif e.description:
                brief += f"：{e.description[:60]}"

            pieces.append(ContextPiece("world", f"世界观：{e.name}", full, brief=brief, priority=score))

    # ─── 6. Active Foreshadows ───
    active_foreshadows = db.query(Foreshadow).filter(
        Foreshadow.novel_id == novel_id,
        Foreshadow.status.in_(["planted", "partially_revealed"])
    ).all()
    if active_foreshadows:
        fs_lines = []
        for f in active_foreshadows:
            line = f"- {f.title}"
            if f.planted_detail:
                line += f"：{f.planted_detail[:100]}"
            if f.expected_resolution:
                line += f"（预期：{f.expected_resolution[:80]}）"
            fs_lines.append(line)
        if fs_lines:
            full = "\n## 未收伏笔\n" + "\n".join(fs_lines) + "\n"
            pieces.append(ContextPiece("foreshadow", "未收伏笔", full, priority=55))

    # ─── 7. Previous Chapters ───
    if prev_chapter_count > 0:
        prev_chapters = db.query(Chapter).filter(
            Chapter.novel_id == novel_id,
            Chapter.content != ""
        ).order_by(Chapter.id.desc()).limit(prev_chapter_count + 1).all()
        if chapter_id:
            prev_chapters = [ch for ch in prev_chapters if ch.id != chapter_id]
        prev_chapters.reverse()

        for i, ch in enumerate(prev_chapters[-prev_chapter_count:]):
            score = 70 - i * 15  # More recent = higher priority
            summary = ch.content[:300].replace("\n", " ") if ch.content else ""
            if len(ch.content or "") > 300:
                summary += "..."
            full = f"\n### {ch.title or f'第{ch.id}章'}\n- 内容摘要：{summary}\n"
            brief = f"{ch.title or f'第{ch.id}章'}：{summary[:80]}"
            pieces.append(ContextPiece("prev_chapter", f"前文：{ch.title or f'第{ch.id}章'}", full, brief=brief, priority=max(score, 20)))

    # ─── 8. Custom Context ───
    if custom_context:
        pieces.append(ContextPiece("custom", "补充说明", f"\n## 补充说明\n{custom_context}\n", priority=90))

    # ─── Budget-aware selection ───
    return _select_within_budget(pieces, context_budget)


def _select_within_budget(pieces: list[ContextPiece], budget: int) -> str:
    """Greedily select context pieces within token budget."""
    # Sort by priority (descending), then by tokens (ascending) for tie-breaking
    pieces.sort(key=lambda p: (-p.priority, p.tokens_full))

    selected = []
    total_tokens = 0

    for piece in pieces:
        remaining = budget - total_tokens

        if remaining <= 0:
            break

        if piece.tokens_full <= remaining:
            selected.append((piece, "full"))
            total_tokens += piece.tokens_full
        elif piece.tokens_brief <= remaining:
            selected.append((piece, "brief"))
            total_tokens += piece.tokens_brief
        elif piece.tokens_minimal <= remaining:
            selected.append((piece, "minimal"))
            total_tokens += piece.tokens_minimal
        # else: skip entirely

    # Re-sort by category order for readable output
    category_order = {"overview": 0, "outline": 1, "character": 2, "plot": 3, "world": 4, "foreshadow": 5, "prev_chapter": 6, "custom": 7}
    selected.sort(key=lambda x: category_order.get(x[0].category, 99))

    # Build section headers
    section_headers = {
        "overview": None,  # Already has header
        "outline": None,
        "character": "\n## 角色信息",
        "plot": "\n## 活跃剧情线",
        "world": "\n## 世界观设定",
        "foreshadow": None,  # Already has header
        "prev_chapter": "\n## 前文回顾",
        "custom": None,  # Already has header
    }

    result_parts = []
    last_category = None
    for piece, level in selected:
        if piece.category != last_category:
            header = section_headers.get(piece.category)
            if header:
                result_parts.append(header)
            last_category = piece.category
        result_parts.append(piece.render(level))

    return "\n".join(result_parts)
