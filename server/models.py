from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .database import Base


class Novel(Base):
    __tablename__ = "novels"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    genre = Column(String(100), default="")
    synopsis = Column(Text, default="")
    cover_url = Column(String(500), default="")
    status = Column(String(20), default="planning")
    target_word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    characters = relationship("Character", back_populates="novel", cascade="all, delete-orphan")
    world_elements = relationship("WorldElement", back_populates="novel", cascade="all, delete-orphan")
    outline_nodes = relationship("OutlineNode", back_populates="novel", cascade="all, delete-orphan")
    plot_threads = relationship("PlotThread", back_populates="novel", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="novel", cascade="all, delete-orphan")
    ai_config = relationship("AIConfig", back_populates="novel", uselist=False, cascade="all, delete-orphan")
    foreshadows = relationship("Foreshadow", back_populates="novel", cascade="all, delete-orphan")
    prompt_templates = relationship("PromptTemplate", back_populates="novel", cascade="all, delete-orphan")


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(20), default="supporting")
    description = Column(Text, default="")
    personality = Column(Text, default="")
    appearance = Column(Text, default="")
    background = Column(Text, default="")
    goals = Column(Text, default="")
    arc_summary = Column(Text, default="")
    speech_style = Column(Text, default="")
    summary_brief = Column(Text, default="")  # One-line brief for context trimming
    tags = Column(JSON, default=list)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    novel = relationship("Novel", back_populates="characters")
    relationships_from = relationship("CharacterRelationship", foreign_keys="CharacterRelationship.character_a_id", back_populates="character_a")
    relationships_to = relationship("CharacterRelationship", foreign_keys="CharacterRelationship.character_b_id", back_populates="character_b")


class CharacterRelationship(Base):
    __tablename__ = "character_relationships"

    id = Column(Integer, primary_key=True, index=True)
    character_a_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    character_b_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    relationship_type = Column(String(50), default="other")
    description = Column(Text, default="")

    character_a = relationship("Character", foreign_keys=[character_a_id], back_populates="relationships_from")
    character_b = relationship("Character", foreign_keys=[character_b_id], back_populates="relationships_to")


class WorldElement(Base):
    __tablename__ = "world_elements"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    category = Column(String(50), default="location")
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    details = Column(JSON, default=dict)
    summary_brief = Column(Text, default="")  # One-line brief for context trimming
    parent_id = Column(Integer, ForeignKey("world_elements.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    novel = relationship("Novel", back_populates="world_elements")
    children = relationship("WorldElement", backref="parent", remote_side=[id], lazy="select")


class OutlineNode(Base):
    __tablename__ = "outline_nodes"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    parent_id = Column(Integer, ForeignKey("outline_nodes.id"), nullable=True)
    node_type = Column(String(20), default="chapter")
    title = Column(String(300), nullable=False)
    summary = Column(Text, default="")
    notes = Column(Text, default="")
    status = Column(String(20), default="planned")
    estimated_words = Column(Integer, default=0)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    novel = relationship("Novel", back_populates="outline_nodes")
    children = relationship("OutlineNode", backref="parent", remote_side=[id], lazy="select", order_by="OutlineNode.sort_order")
    chapter = relationship("Chapter", back_populates="outline_node", uselist=False, cascade="all, delete-orphan")


class PlotThread(Base):
    __tablename__ = "plot_threads"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="setup")
    thread_type = Column(String(20), default="main")
    related_character_ids = Column(JSON, default=list)
    related_outline_ids = Column(JSON, default=list)
    resolution_notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    novel = relationship("Novel", back_populates="plot_threads")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    outline_node_id = Column(Integer, ForeignKey("outline_nodes.id"), nullable=True)
    title = Column(String(300), default="")
    content = Column(Text, default="")
    word_count = Column(Integer, default=0)
    status = Column(String(20), default="draft")
    version = Column(Integer, default=1)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    novel = relationship("Novel", back_populates="chapters")
    outline_node = relationship("OutlineNode", back_populates="chapter")
    versions = relationship("ChapterVersion", back_populates="chapter", cascade="all, delete-orphan", order_by="ChapterVersion.version_number.desc()")


class ChapterVersion(Base):
    """Version history for chapter content."""
    __tablename__ = "chapter_versions"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=False)
    content = Column(Text, default="")
    word_count = Column(Integer, default=0)
    version_number = Column(Integer, default=1)
    change_summary = Column(String(500), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    chapter = relationship("Chapter", back_populates="versions")


class Foreshadow(Base):
    """Track foreshadowing elements across chapters."""
    __tablename__ = "foreshadows"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")
    planted_chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    planted_detail = Column(Text, default="")  # What exactly was planted
    expected_resolution = Column(Text, default="")  # How it should be resolved
    resolve_chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    status = Column(String(20), default="planted")  # planted, partially_revealed, resolved, abandoned
    priority = Column(Integer, default=5)  # 1-10, higher = more important
    related_character_ids = Column(JSON, default=list)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    novel = relationship("Novel", back_populates="foreshadows")


class PromptTemplate(Base):
    """Reusable prompt templates for AI writing."""
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(300), default="")
    category = Column(String(50), default="custom")  # battle, dialogue, description, flashback, transition, custom
    prompt_template = Column(Text, default="")
    is_builtin = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    novel = relationship("Novel", back_populates="prompt_templates")


class AIConfig(Base):
    __tablename__ = "ai_configs"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False, unique=True)
    provider = Column(String(50), default="openai")
    api_url = Column(String(500), default="https://api.openai.com/v1/chat/completions")
    api_key = Column(String(500), default="")
    model = Column(String(100), default="gpt-4o-mini")
    system_prompt = Column(Text, default="")
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=4000)
    context_strategy = Column(String(20), default="auto")
    context_budget = Column(Integer, default=6000)  # Max tokens for assembled context

    novel = relationship("Novel", back_populates="ai_config")
