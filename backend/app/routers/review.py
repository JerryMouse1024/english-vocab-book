"""复习管理路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud
from app.ebbinghaus import calculate_next_review, get_today_review_tasks
from app.schemas import ReviewCompleteRequest

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/today")
async def today_review(db: Session = Depends(get_db)):
    """获取今日待复习单词列表"""
    tasks = get_today_review_tasks(db)
    return {"tasks": tasks, "total": len(tasks)}


@router.post("/complete/{collection_id}")
async def complete_review(collection_id: int, req: ReviewCompleteRequest, db: Session = Depends(get_db)):
    """完成一个单词的复习"""
    if req.result not in ("pass", "fail"):
        raise HTTPException(status_code=400, detail="result 必须为 pass 或 fail")

    collection = crud.get_collection_by_id(db, collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="收藏记录不存在")

    # 计算新的复习状态
    new_stage, next_review, mastered = calculate_next_review(collection.review_stage, req.result)

    # 更新收藏记录
    collection.review_stage = new_stage
    collection.next_review = next_review
    collection.review_count += 1
    collection.mastered = 1 if mastered else 0
    db.commit()

    # 记录复习历史
    crud.create_review_record(db, collection_id, new_stage, req.result)

    return {
        "collection_id": collection_id,
        "new_stage": new_stage,
        "next_review": next_review.isoformat(),
        "mastered": mastered,
        "message": "已掌握！" if mastered else ("复习通过" if req.result == "pass" else "已重置，明天再来"),
    }
