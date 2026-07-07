"""句子查词与收藏路由"""
import json
import re
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud
from app.schemas import SentenceQueryRequest, SentenceCollectRequest

router = APIRouter(prefix="/api", tags=["sentences"])

UAPI_BASE = "https://uapis.cn/api/v1/dictionary"


@router.post("/sentence/query")
async def query_sentence(req: SentenceQueryRequest, db: Session = Depends(get_db)):
    """句子查词：拆句 -> 逐词查询"""
    sentence = req.sentence.strip()
    if not sentence:
        raise HTTPException(status_code=400, detail="请输入句子")

    # 提取英文单词
    raw_words = re.findall(r'\b[a-zA-Z]+\b', sentence)
    # 去重保持顺序
    unique_words = list(dict.fromkeys([w.lower() for w in raw_words]))

    if not unique_words:
        return {"original": sentence, "words": []}

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
        else:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.get(f"{UAPI_BASE}/lookup", params={"word": w})
                    if resp.status_code == 200:
                        data = resp.json()
                        if data.get("found"):
                            cached = crud.create_word(db, data)
                            word_results.append({
                                "word": cached.word,
                                "definitions": json.loads(cached.definitions) if cached.definitions else [],
                                "phonetics_uk": cached.phonetics_uk,
                                "phonetics_us": cached.phonetics_us,
                                "audio_uk_url": cached.audio_uk_url,
                                "audio_us_url": cached.audio_us_url,
                            })
                        else:
                            word_results.append({"word": w, "definitions": [], "phonetics_uk": None, "phonetics_us": None, "audio_uk_url": None, "audio_us_url": None})
                    else:
                        word_results.append({"word": w, "definitions": [], "phonetics_uk": None, "phonetics_us": None, "audio_uk_url": None, "audio_us_url": None})
            except Exception:
                word_results.append({"word": w, "definitions": [], "phonetics_uk": None, "phonetics_us": None, "audio_uk_url": None, "audio_us_url": None})

    return {"original": sentence, "words": word_results}


@router.post("/sentence/collect")
async def collect_sentence(req: SentenceCollectRequest, db: Session = Depends(get_db)):
    """收藏句子"""
    sc = crud.create_sentence_collection(db, req.original, req.translation, req.words_json)
    return {"id": sc.id, "message": "句子已收藏"}


@router.get("/sentences")
async def list_sentences(db: Session = Depends(get_db)):
    """获取句子收藏列表"""
    items = crud.get_sentence_list(db)
    return {
        "items": [
            {
                "id": s.id,
                "original": s.original,
                "translation": s.translation,
                "words_json": s.words_json,
                "collected_at": s.collected_at.isoformat(),
            }
            for s in items
        ]
    }


@router.delete("/sentence/{sentence_id}")
async def remove_sentence(sentence_id: int, db: Session = Depends(get_db)):
    """删除句子收藏"""
    if crud.delete_sentence(db, sentence_id):
        return {"message": "句子已删除"}
    raise HTTPException(status_code=404, detail="句子记录不存在")
