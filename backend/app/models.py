"""SQLAlchemy ORM 模型"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from app.database import Base


class Word(Base):
    """单词缓存表"""
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word = Column(String(255), nullable=False, unique=True, index=True)
    phonetics_uk = Column(String(255), nullable=True)
    phonetics_us = Column(String(255), nullable=True)
    audio_uk_url = Column(Text, nullable=True)
    audio_us_url = Column(Text, nullable=True)
    exam_tags = Column(Text, nullable=True)          # JSON array
    definitions = Column(Text, nullable=False)        # JSON array
    english_defs = Column(Text, nullable=True)        # JSON array
    word_forms = Column(Text, nullable=True)          # JSON array
    phrases = Column(Text, nullable=True)             # JSON array
    synonyms = Column(Text, nullable=True)            # JSON array
    examples = Column(Text, nullable=True)            # JSON array
    created_at = Column(DateTime, default=datetime.now)


class Collection(Base):
    """单词收藏表"""
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    word_id = Column(Integer, ForeignKey("words.id", ondelete="CASCADE"), nullable=False)
    note = Column(Text, nullable=True)
    review_stage = Column(Integer, nullable=False, default=0)
    next_review = Column(DateTime, nullable=False, default=datetime.now)
    review_count = Column(Integer, nullable=False, default=0)
    mastered = Column(Integer, nullable=False, default=0)
    collected_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("idx_collections_word_id", "word_id"),
        Index("idx_collections_next_review", "next_review"),
    )


class ReviewRecord(Base):
    """复习记录表"""
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    collection_id = Column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    stage = Column(Integer, nullable=False)
    reviewed_at = Column(DateTime, default=datetime.now)
    result = Column(String(10), nullable=False, default="pass")

    __table_args__ = (
        Index("idx_review_records_collection_id", "collection_id"),
    )


class SentenceCollection(Base):
    """句子收藏表"""
    __tablename__ = "sentence_collections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    original = Column(Text, nullable=False)
    translation = Column(Text, nullable=True)
    words_json = Column(Text, nullable=True)
    collected_at = Column(DateTime, default=datetime.now)
