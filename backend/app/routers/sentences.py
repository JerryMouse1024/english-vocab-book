"""句子查词与收藏路由"""
import json
import re
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud
from app import uapi
from app import translate as translate_mod
from app.schemas import SentenceQueryRequest, SentenceCollectRequest

router = APIRouter(prefix="/api", tags=["sentences"])


@router.post("/sentence/query")
async def query_sentence(req: SentenceQueryRequest, db: Session = Depends(get_db)):
    """句子查词：拆句 -> 逐词查询，并返回整句中文翻译"""
    sentence = req.sentence.strip()
    if not sentence:
        raise HTTPException(status_code=400, detail="请输入句子")

    # 整句翻译与逐词查询并发进行，互不阻塞
    translation_task = asyncio.create_task(
        translate_mod.translate_en_to_zh(sentence)
    )

    # 提取英文单词
    raw_words = re.findall(r'\b[a-zA-Z]+\b', sentence)
    # 去重保持顺序
    unique_words = list(dict.fromkeys([w.lower() for w in raw_words]))

    if not unique_words:
        translation = await translation_task
        return {"original": sentence, "translation": translation, "words": []}

    word_results = []
    for w in unique_words:
        # 优先查本地缓存
        cached = crud.get_word_by_name(db, w)
        if cached:
            word_results.append({
                "word": cached.word,
                "definitions": json.loads(cached.definitions) if cached.definitions else [],
                "phonetics_uk": cached.phonetics_uk,
                "phonetics_us": cached.phonetics_us,
                "audio_uk_url": cached.audio_uk_url,
                "audio_us_url": cached.audio_us_url,
            })
            continue

        try:
            data = await uapi.lookup_word(w)
            if data is None:
                word_results.append({
                    "word": w, "definitions": None, "error": True,
                    "phonetics_uk": None, "phonetics_us": None,
                    "audio_uk_url": None, "audio_us_url": None,
                })
                continue
            cached = crud.create_word(db, data)
            word_results.append({
                "word": cached.word,
                "definitions": json.loads(cached.definitions) if cached.definitions else [],
                "phonetics_uk": cached.phonetics_uk,
                "phonetics_us": cached.phonetics_us,
                "audio_uk_url": cached.audio_uk_url,
                "audio_us_url": cached.audio_us_url,
            })
        except HTTPException:
            # 单个词查询失败不影响整句，标记 error 让前端提示
            word_results.append({
                "word": w, "definitions": None, "error": True,
                "phonetics_uk": None, "phonetics_us": None,
                "audio_uk_url": None, "audio_us_url": None,
            })

    translation = await translation_task
    return {"original": sentence, "translation": translation, "words": word_results}


@router.post("/sentence/collect")
async def collect_sentence(req: SentenceCollectRequest, db: Session = Depends(get_db)):
    """收藏句子"""
    sc = crud.create_sentence_collection(db, req.original, req.translation, req.words_json)
    return {"id": sc.id, "message": "句子已收藏"}


@router.get("/sentences")
async def list_sentences(db: Session = Depends(get_db)):
    """获取句子收藏列表（含复习状态）"""
    items = crud.get_sentence_list(db)
    return {"items": items}


@router.delete("/sentence/{sentence_id}")
async def remove_sentence(sentence_id: int, db: Session = Depends(get_db)):
    """删除句子收藏"""
    if crud.delete_sentence(db, sentence_id):
        return {"message": "句子已删除"}
    raise HTTPException(status_code=404, detail="句子记录不存在")
