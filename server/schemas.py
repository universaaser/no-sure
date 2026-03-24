from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ─── Novel ───
class NovelCreate(BaseModel):
    title: str
    genre: str = ""
    synopsis: str = ""
    status: str = "planning"
    target_word_count: int = 0

class NovelUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[str] = None
    synopsis: Optional[str] = None
    status: Optional[str] = None
    target_word_count: Optional[int] = None

class NovelOut(BaseModel):
    id: int
    title: str
    genre: str
    synopsis: str
    status: str
    target_word_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Character ───
class CharacterCreate(BaseModel):
    name: str
    role: str = "supporting"
    description: str = ""
    personality: str = ""
    appearance: str = ""
    background: str = ""
    goals: str = ""
    arc_summary: str = ""
    speech_style: str = ""
    tags: list = []
    sort_order: int = 0

class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    personality: Optional[str] = None
    appearance: Optional[str] = None
    background: Optional[str] = None
    goals: Optional[str] = None
    arc_summary: Optional[str] = None
    speech_style: Optional[str] = None
    tags: Optional[list] = None
    sort_order: Optional[int] = None

class CharacterOut(BaseModel):
    id: int
    novel_id: int
    name: str
    role: str
    description: str
    personality: str
    appearance: str
    background: str
    goals: str
    arc_summary: str
    speech_style: str
    tags: list
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Character Relationship ───
class RelationshipCreate(BaseModel):
    character_a_id: int
    character_b_id: int
    relationship_type: str = "other"
    description: str = ""

class RelationshipOut(BaseModel):
    id: int
    character_a_id: int
    character_b_id: int
    relationship_type: str
    description: str

    class Config:
        from_attributes = True


# ─── World Element ───
class WorldElementCreate(BaseModel):
    category: str = "location"
    name: str
    description: str = ""
    details: dict = {}
    parent_id: Optional[int] = None
    sort_order: int = 0

class WorldElementUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    details: Optional[dict] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None

class WorldElementOut(BaseModel):
    id: int
    novel_id: int
    category: str
    name: str
    description: str
    details: dict
    parent_id: Optional[int]
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Outline Node ───
class OutlineNodeCreate(BaseModel):
    parent_id: Optional[int] = None
    node_type: str = "chapter"
    title: str
    summary: str = ""
    notes: str = ""
    status: str = "planned"
    estimated_words: int = 0
    sort_order: int = 0

class OutlineNodeUpdate(BaseModel):
    parent_id: Optional[int] = None
    node_type: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    estimated_words: Optional[int] = None
    sort_order: Optional[int] = None

class OutlineNodeOut(BaseModel):
    id: int
    novel_id: int
    parent_id: Optional[int]
    node_type: str
    title: str
    summary: str
    notes: str
    status: str
    estimated_words: int
    sort_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Plot Thread ───
class PlotThreadCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "setup"
    thread_type: str = "main"
    related_character_ids: list = []
    related_outline_ids: list = []
    resolution_notes: str = ""

class PlotThreadUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    thread_type: Optional[str] = None
    related_character_ids: Optional[list] = None
    related_outline_ids: Optional[list] = None
    resolution_notes: Optional[str] = None

class PlotThreadOut(BaseModel):
    id: int
    novel_id: int
    title: str
    description: str
    status: str
    thread_type: str
    related_character_ids: list
    related_outline_ids: list
    resolution_notes: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Chapter ───
class ChapterCreate(BaseModel):
    outline_node_id: Optional[int] = None
    title: str = ""
    content: str = ""
    status: str = "draft"
    notes: str = ""

class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class ChapterOut(BaseModel):
    id: int
    novel_id: int
    outline_node_id: Optional[int]
    title: str
    content: str
    word_count: int
    status: str
    version: int
    notes: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── AI Config ───
class AIConfigCreate(BaseModel):
    provider: str = "openai"
    api_url: str = "https://api.openai.com/v1/chat/completions"
    api_key: str = ""
    model: str = "gpt-4o-mini"
    system_prompt: str = ""
    temperature: float = 0.7
    max_tokens: int = 4000
    context_strategy: str = "auto"

class AIConfigUpdate(BaseModel):
    provider: Optional[str] = None
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    context_strategy: Optional[str] = None

class AIConfigOut(BaseModel):
    id: int
    novel_id: int
    provider: str
    api_url: str
    model: str
    system_prompt: str
    temperature: float
    max_tokens: int
    context_strategy: str

    class Config:
        from_attributes = True


# ─── AI Writing Request ───
class AIWriteRequest(BaseModel):
    chapter_id: Optional[int] = None
    outline_node_id: Optional[int] = None
    prompt: str = ""
    include_characters: list = []  # character ids to include
    include_plot_threads: list = []  # plot thread ids to include
    include_world_elements: list = []  # world element ids to include
    prev_chapter_count: int = 2  # how many previous chapter summaries to include
    custom_context: str = ""  # additional context from user


class AIWriteResponse(BaseModel):
    success: bool
    content: str = ""
    context_used: str = ""
    error: str = ""
