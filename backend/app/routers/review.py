"""复习管理路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app import crud
from app.ebbinghaus import calculate_next_review, get_today_review_tasks

router = APIRouter(prefix="/api/review", tags=["review"])


class ReviewCompleteRequest(BaseModel):
    result: str          # "pass" 或 "fail"
    kind: str = "word"   # "word" 或 "sentence"


@router.get("/today")
async def today_review(db: Session = Depends(get_db)):
    """获取今日待复习列表（单词 + 句子）"""
    tasks = get_today_review_tasks(db)
    return {"tasks": tasks, "total": len(tasks)}


@router.post("/complete/{item_id}")
async def complete_review(item_id: int, req: ReviewCompleteRequest, db: Session = Depends(get_db)):
    """完成复习（支持单词和句子）"""
    if req.result not in ("pass", "fail"):
        raise HTTPException(status_code=400, detail="result 必须为 pass 或 fail")
    if req.kind not in ("word", "sentence"):
        raise HTTPException(status_code=400, detail="kind 必须为 word 或 sentence")

    if req.kind == "word":
        collection = crud.get_collection_by_id(db, item_id)
        if not collection:
            raise HTTPException(status_code=404, detail="收藏记录不存在")
        new_stage, next_review, mastered = calculate_next_review(collection.review_stage, req.result)
        collection.review_stage = new_stage
        collection.next_review = next_review
        collection.review_count += 1
        collection.mastered = 1 if mastered else 0
        db.commit()
        crud.create_review_record(db, item_id, new_stage, req.result)
        return {
            "id": item_id,
            "kind": "word",
            "new_stage": new_stage,
            "next_review": next_review.isoformat(),
            "mastered": mastered,
            "message": "已掌握！" if mastered else ("复习通过" if req.result == "pass" else "已重置，明天再来"),
        }
    else:
        sc = crud.get_sentence_collection_by_id(db, item_id)
        if not sc:
            raise HTTPException(status_code=404, detail="句子收藏记录不存在")
        new_stage, next_review, mastered = calculate_next_review(sc.review_stage, req.result)
        sc.review_stage = new_stage
        sc.next_review = next_review
        sc.review_count += 1
        sc.mastered = 1 if mastered else 0
        db.commit()
        crud.create_sentence_review_record(db, item_id, new_stage, req.result)
        return {
            "id": item_id,
            "kind": "sentence",
            "new_stage": new_stage,
            "next_review": next_review.isoformat(),
            "mastered": mastered,
            "message": "已掌握！" if mastered else ("复习通过" if req.result == "pass" else "已重置，明天再来"),
        }
