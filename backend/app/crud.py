"""数据库 CRUD 操作"""
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.models import Word, Collection, ReviewRecord, SentenceCollection, SentenceReviewRecord


def normalize_word_key(word: str) -> str:
    """
    规范化查词缓存键：去首尾空白、转小写、去除首尾标点。

    避免 'what is it?' 与 'what is it' 因句末标点（? ! . 等）键不一致，
    导致缓存永远命中不了、重复回源 UAPI，进而触发 UNIQUE 约束冲突。
    仅去除首尾标点，保留内部连字符与撇号（如 don't、well-known）。
    """
    if not word:
        return ""
    s = word.strip().lower()
    return s.strip(" \t\r\n?.!;:，。！？；：、()（）")


# ===== 单词缓存 =====

def get_word_by_name(db: Session, word: str) -> Word | None:
    return db.query(Word).filter(Word.word == word).first()


def update_word_definitions(db: Session, word_id: int, definitions: str) -> Word | None:
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        return None
    word.definitions = definitions
    db.commit()
    return word


def _build_word_entry(entry: dict) -> Word:
    """根据 UAPI entry 构造 Word 对象（不含入库动作）"""
    return Word(
        word=(entry.get("word") or "").strip().lower(),
        phonetics_uk=(entry.get("phonetics", {}) or {}).get("uk", {}).get("text") if entry.get("phonetics") else None,
        phonetics_us=(entry.get("phonetics", {}) or {}).get("us", {}).get("text") if entry.get("phonetics") else None,
        audio_uk_url=(entry.get("phonetics", {}) or {}).get("uk", {}).get("audio") if entry.get("phonetics") else None,
        audio_us_url=(entry.get("phonetics", {}) or {}).get("us", {}).get("audio") if entry.get("phonetics") else None,
        exam_tags=json.dumps(entry.get("exam_tags", []), ensure_ascii=False) if entry.get("exam_tags") else None,
        definitions=json.dumps(entry.get("definitions", []), ensure_ascii=False),
        english_defs=json.dumps(entry.get("english_definitions", []), ensure_ascii=False) if entry.get("english_definitions") else None,
        word_forms=json.dumps(entry.get("word_forms", []), ensure_ascii=False) if entry.get("word_forms") else None,
        phrases=json.dumps(entry.get("phrases", []), ensure_ascii=False) if entry.get("phrases") else None,
        synonyms=json.dumps(entry.get("synonyms", []), ensure_ascii=False) if entry.get("synonyms") else None,
        examples=json.dumps(entry.get("examples", []), ensure_ascii=False) if entry.get("examples") else None,
    )


def create_word(db: Session, word_data: dict) -> Word:
    """
    从 UAPI 解析结果创建/获取单词缓存记录（幂等 upsert）。

    若单词已存在则直接返回已有记录，避免 UNIQUE 约束冲突导致的 500 错误。
    并对并发插入做了 IntegrityError 兜底。
    """
    entry = word_data.get("entry", word_data)
    word_text = normalize_word_key(entry.get("word") or "")
    if not word_text:
        word_text = "unknown"

    # 已存在则直接返回
    existing = db.query(Word).filter(Word.word == word_text).first()
    if existing:
        return existing

    try:
        word = _build_word_entry(entry)
        db.add(word)
        db.commit()
        db.refresh(word)
        return word
    except IntegrityError:
        # 并发插入导致冲突：回滚后返回已存在的记录
        db.rollback()
        existing = db.query(Word).filter(Word.word == word_text).first()
        if existing:
            return existing
        raise


def word_to_response(word: Word, is_collected: bool = False) -> dict:
    """将 Word ORM 对象转换为响应字典"""
    return {
        "word": word.word,
        "phonetics_uk": word.phonetics_uk,
        "phonetics_us": word.phonetics_us,
        "audio_uk_url": word.audio_uk_url,
        "audio_us_url": word.audio_us_url,
        "exam_tags": json.loads(word.exam_tags) if word.exam_tags else None,
        "definitions": json.loads(word.definitions) if word.definitions else [],
        "english_defs": json.loads(word.english_defs) if word.english_defs else None,
        "word_forms": json.loads(word.word_forms) if word.word_forms else None,
        "phrases": json.loads(word.phrases) if word.phrases else None,
        "synonyms": json.loads(word.synonyms) if word.synonyms else None,
        "examples": json.loads(word.examples) if word.examples else None,
        "is_collected": is_collected,
    }


# ===== 收藏管理 =====

def is_collected(db: Session, word_id: int) -> bool:
    return db.query(Collection).filter(Collection.word_id == word_id).first() is not None


def create_collection(db: Session, word_id: int, note: str | None = None) -> Collection:
    existing = db.query(Collection).filter(Collection.word_id == word_id).first()
    if existing:
        return existing
    collection = Collection(
        word_id=word_id,
        note=note,
        review_stage=0,
        next_review=datetime.now(),
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return collection


def delete_collection(db: Session, collection_id: int) -> bool:
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        return False
    db.delete(collection)
    db.commit()
    return True


def get_word_list(db: Session, q: str | None = None, page: int = 1, size: int = 20):
    query = db.query(Collection, Word).join(Word, Collection.word_id == Word.id)
    if q:
        query = query.filter(Word.word.like(f"%{q}%"))
    query = query.order_by(Collection.collected_at.desc())

    total = query.count()
    rows = query.offset((page - 1) * size).limit(size).all()

    items = []
    for coll, word in rows:
        defs = json.loads(word.definitions) if word.definitions else []
        summary = defs[0].get("meaning", "") if defs else ""
        # 拼接所有词性+释义，用于收藏本展示
        full_definitions = "; ".join(
            f"{d.get('part_of_speech', '')} {d.get('meaning', '')}".strip()
            for d in defs if d.get("meaning")
        )
        items.append({
            "id": coll.id,
            "word_id": word.id,
            "word": word.word,
            "phonetics_uk": word.phonetics_uk,
            "phonetics_us": word.phonetics_us,
            "definitions_summary": summary,
            "definitions": full_definitions,
            "definitions_parsed": defs,
            "examples": json.loads(word.examples) if word.examples else None,
            "review_stage": coll.review_stage,
            "review_count": coll.review_count,
            "next_review": coll.next_review,
            "mastered": bool(coll.mastered),
            "collected_at": coll.collected_at,
        })

    return {"items": items, "total": total}


def get_collection_by_id(db: Session, collection_id: int) -> Collection | None:
    return db.query(Collection).filter(Collection.id == collection_id).first()


# ===== 复习记录 =====

def create_review_record(db: Session, collection_id: int, stage: int, result: str) -> ReviewRecord:
    record = ReviewRecord(
        collection_id=collection_id,
        stage=stage,
        result=result,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ===== 句子收藏 =====

def create_sentence_collection(db: Session, original: str, translation: str | None = None, words_json: str | None = None) -> SentenceCollection:
    sc = SentenceCollection(
        original=original,
        translation=translation,
        words_json=words_json,
        review_stage=0,
        next_review=datetime.now(),
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)
    return sc


def get_sentence_list(db: Session):
    rows = db.query(SentenceCollection).order_by(SentenceCollection.collected_at.desc()).all()
    return [
        {
            "id": s.id,
            "original": s.original,
            "translation": s.translation,
            "words_json": s.words_json,
            "review_stage": s.review_stage,
            "review_count": s.review_count,
            "next_review": s.next_review,
            "mastered": bool(s.mastered),
            "collected_at": s.collected_at.isoformat(),
        }
        for s in rows
    ]


def delete_sentence(db: Session, sentence_id: int) -> bool:
    sc = db.query(SentenceCollection).filter(SentenceCollection.id == sentence_id).first()
    if not sc:
        return False
    db.delete(sc)
    db.commit()
    return True


def get_sentence_collection_by_id(db: Session, sentence_id: int) -> SentenceCollection | None:
    return db.query(SentenceCollection).filter(SentenceCollection.id == sentence_id).first()


def create_sentence_review_record(db: Session, sentence_collection_id: int, stage: int, result: str) -> SentenceReviewRecord:
    record = SentenceReviewRecord(
        sentence_collection_id=sentence_collection_id,
        stage=stage,
        result=result,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
