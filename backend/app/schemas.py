"""Pydantic 请求/响应模式"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ---- 单词相关 ----
class WordLookupResponse(BaseModel):
    word: str
    phonetics_uk: Optional[str] = None
    phonetics_us: Optional[str] = None
    audio_uk_url: Optional[str] = None
    audio_us_url: Optional[str] = None
    syllable: Optional[str] = None
    syllable_html: Optional[str] = None
    exam_tags: Optional[List[str]] = None
    definitions: List[dict] = []
    english_defs: Optional[List[dict]] = None
    word_forms: Optional[List[dict]] = None
    phrases: Optional[List[dict]] = None
    synonyms: Optional[List[dict]] = None
    examples: Optional[List[dict]] = None
    is_collected: bool = False

    class Config:
        from_attributes = True


class WordCollectRequest(BaseModel):
    word: str
    note: Optional[str] = None


class WordListItem(BaseModel):
    id: int
    word_id: int
    word: str
    phonetics_uk: Optional[str] = None
    phonetics_us: Optional[str] = None
    syllable: Optional[str] = None
    syllable_html: Optional[str] = None
    definitions_summary: str
    definitions: str = ""
    definitions_parsed: List[dict] = []
    examples: Optional[List[dict]] = None
    review_stage: int
    review_count: int = 0
    next_review: datetime
    mastered: bool
    collected_at: datetime

    class Config:
        from_attributes = True


class WordListResponse(BaseModel):
    items: List[WordListItem]
    total: int


# ---- 复习相关 ----
class ReviewTaskItem(BaseModel):
    collection_id: int
    word_id: int
    word: str
    phonetics_uk: Optional[str] = None
    phonetics_us: Optional[str] = None
    syllable: Optional[str] = None
    syllable_html: Optional[str] = None
    audio_uk_url: Optional[str] = None
    audio_us_url: Optional[str] = None
    definitions: List[dict] = []
    examples: Optional[List[dict]] = None
    stage: int
    review_count: int

    class Config:
        from_attributes = True


class ReviewCompleteRequest(BaseModel):
    result: str = "pass"


# ---- 句子相关 ----
class SentenceQueryRequest(BaseModel):
    sentence: str


class WordInSentence(BaseModel):
    word: str
    definitions: Optional[List[dict]] = None
    phonetics_uk: Optional[str] = None
    phonetics_us: Optional[str] = None
    audio_uk_url: Optional[str] = None
    audio_us_url: Optional[str] = None


class SentenceQueryResponse(BaseModel):
    original: str
    translation: Optional[str] = None
    words: List[WordInSentence]


class SentenceCollectRequest(BaseModel):
    original: str
    translation: Optional[str] = None
    words_json: Optional[str] = None


class SentenceListItem(BaseModel):
    id: int
    original: str
    translation: Optional[str] = None
    words_json: Optional[str] = None
    review_stage: int = 0
    review_count: int = 0
    next_review: Optional[datetime] = None
    mastered: bool = False
    collected_at: Optional[datetime] = None

    class Config:
        from_attributes = True
