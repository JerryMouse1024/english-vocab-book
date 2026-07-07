"""单词查询与收藏路由"""
import json
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app import crud
from app import uapi
from app.schemas import WordCollectRequest, WordListResponse

router = APIRouter(prefix="/api", tags=["words"])


class WordUpdateRequest(BaseModel):
    definitions: str


@router.get("/word/{word}")
async def lookup_word(word: str, db: Session = Depends(get_db)):
    """查询单词释义（优先本地缓存，否则代理UAPI，失败回退备选数据源）"""
    word_key = crud.normalize_word_key(word)
    if not word_key:
        raise HTTPException(status_code=400, detail="请输入单词")

    # 先查本地缓存
    cached = crud.get_word_by_name(db, word_key)
    if cached:
        is_col = crud.is_collected(db, cached.id)
        return crud.word_to_response(cached, is_collected=is_col)

    # 调用 UAPI（含重试与备选数据源回退）
    data = await uapi.lookup_word(word_key)
    if data is None:
        raise HTTPException(status_code=404, detail="未找到该单词的释义")

    # 缓存到本地
    cached = crud.create_word(db, data)
    return crud.word_to_response(cached, is_collected=False)


@router.post("/word/collect")
async def collect_word(req: WordCollectRequest, db: Session = Depends(get_db)):
    """收藏单词到单词本"""
    word_key = crud.normalize_word_key(req.word)
    if not word_key:
        raise HTTPException(status_code=400, detail="请输入单词")

    # 确保单词已在缓存中
    word_record = crud.get_word_by_name(db, word_key)
    if not word_record:
        # 先查词再缓存
        data = await uapi.lookup_word(word_key)
        if data is None:
            raise HTTPException(status_code=404, detail="未找到该单词的释义")
        word_record = crud.create_word(db, data)

    collection = crud.create_collection(db, word_record.id, req.note)
    return {"id": collection.id, "message": "收藏成功", "word": word_key}


@router.delete("/word/collect/{collection_id}")
async def remove_collection(collection_id: int, db: Session = Depends(get_db)):
    """删除收藏"""
    if crud.delete_collection(db, collection_id):
        return {"message": "已取消收藏"}
    raise HTTPException(status_code=404, detail="收藏记录不存在")


@router.get("/words", response_model=WordListResponse)
async def list_words(
    q: str = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """获取单词本列表"""
    return crud.get_word_list(db, q=q, page=page, size=size)


@router.get("/word/{word}/audio/{accent}")
async def get_word_audio(word: str, accent: str, db: Session = Depends(get_db)):
    """获取单词发音音频（优先本地缓存，否则代理UAPI，失败回退备选数据源）"""
    word_key = crud.normalize_word_key(word)
    if accent not in ("uk", "us"):
        raise HTTPException(status_code=400, detail="accent 参数必须为 uk 或 us")

    # 先查本地缓存的音频URL
    cached = crud.get_word_by_name(db, word_key)
    audio_url = None
    if cached:
        audio_url = cached.audio_uk_url if accent == "uk" else cached.audio_us_url

    if not audio_url:
        audio_url = await uapi.fetch_audio_url(word_lower, accent)

    if not audio_url:
        raise HTTPException(status_code=404, detail="该单词暂无发音")

    # 代理音频流
    full_audio_url = audio_url if audio_url.startswith("http") else f"https://uapis.cn{audio_url}"
    async def stream_audio():
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("GET", full_audio_url) as resp:
                async for chunk in resp.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream_audio(), media_type="audio/mpeg")


@router.put("/word/definitions/{word_id}")
async def update_word_definitions(word_id: int, req: WordUpdateRequest, db: Session = Depends(get_db)):
    """更新单词释义"""
    word = crud.update_word_definitions(db, word_id, req.definitions)
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    return {"id": word.id, "message": "已更新"}
