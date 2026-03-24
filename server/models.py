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
    status = Column(String(20), default="planning")  # planning, writing, completed, paused
    target_word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    characters = relationship("Character", back_populates="novel", cascade="all, delete-orphan")
    world_elements = relationship("WorldElement", back_populates="novel", cascade="all, delete-orphan")
    outline_nodes = relationship("OutlineNode", back_populates="novel", cascade="all, delete-orphan")
    plot_threads = relationship("PlotThread", back_populates="novel", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="novel", cascade="all, delete-orphan")
    ai_config = relationship("AIConfig", back_populates="novel", uselist=False, cascade="all, delete-orphan")


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(20), default="supporting")  # protagonist, antagonist, supporting, minor
    description = Column(Text, default="")
    personality = Column(Text, default="")
    appearance = Column(Text, default="")
    background = Column(Text, default="")
    goals = Column(Text, default="")
    arc_summary = Column(Text, default="")
    speech_style = Column(Text, default="")
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
    relationship_type = Column(String(50), default="other")  # family, friend, enemy, lover, mentor, rival, other
    description = Column(Text, default="")

    character_a = relationship("Character", foreign_keys=[character_a_id], back_populates="relationships_from")
    character_b = relationship("Character", foreign_keys=[character_b_id], back_populates="relationships_to")


class WorldElement(Base):
    __tablename__ = "world_elements"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    category = Column(String(50), default="location")  # location, organization, rule, history, item, culture, magic_system, technology
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    details = Column(JSON, default=dict)
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
    node_type = Column(String(20), default="chapter")  # volume, arc, chapter, scene
    title = Column(String(300), nullable=False)
    summary = Column(Text, default="")
    notes = Column(Text, default="")
    status = Column(String(20), default="planned")  # planned, writing, done
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
    status = Column(String(20), default="setup")  # setup, developing, climax, resolved, abandoned
    thread_type = Column(String(20), default="main")  # main, subplot, mystery, romance, conflict
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
    status = Column(String(20), default="draft")  # draft, revised, final
    version = Column(Integer, default=1)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    novel = relationship("Novel", back_populates="chapters")
    outline_node = relationship("OutlineNode", back_populates="chapter")


class AIConfig(Base):
    __tablename__ = "ai_configs"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False, unique=True)
    provider = Column(String(50), default="openai")  # openai, custom
    api_url = Column(String(500), default="https://api.openai.com/v1/chat/completions")
    api_key = Column(String(500), default="")
    model = Column(String(100), default="gpt-4o-mini")
    system_prompt = Column(Text, default="")
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=4000)
    context_strategy = Column(String(20), default="auto")  # auto, manual, minimal

    novel = relationship("Novel", back_populates="ai_config")
