"""数据库 CRUD 操作"""
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import Word, Collection, ReviewRecord, SentenceCollection


# ===== 单词缓存 =====

def get_word_by_name(db: Session, word: str) -> Word | None:
    return db.query(Word).filter(Word.word == word).first()


def create_word(db: Session, word_data: dict) -> Word:
    """从UAPI解析结果创建单词缓存记录"""
    entry = word_data.get("entry", word_data)
    word = Word(
        word=entry.get("word", ""),
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
    db.add(word)
    db.commit()
    db.refresh(word)
    return word


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
        items.append({
            "id": coll.id,
            "word_id": word.id,
            "word": word.word,
            "phonetics_uk": word.phonetics_uk,
            "phonetics_us": word.phonetics_us,
            "definitions_summary": summary,
            "review_stage": coll.review_stage,
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
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)
    return sc


def get_sentence_list(db: Session):
    return db.query(SentenceCollection).order_by(SentenceCollection.collected_at.desc()).all()


def delete_sentence(db: Session, sentence_id: int) -> bool:
    sc = db.query(SentenceCollection).filter(SentenceCollection.id == sentence_id).first()
    if not sc:
        return False
    db.delete(sc)
    db.commit()
    return True
