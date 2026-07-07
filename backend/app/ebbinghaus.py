"""艾宾浩斯遗忘曲线复习算法"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import Collection, Word
import json

# 艾宾浩斯复习间隔（天数）
EBBINGHAUS_INTERVALS = [0, 1, 2, 4, 7, 15, 30, 90]
MAX_STAGE = len(EBBINGHAUS_INTERVALS) - 1  # 7


def get_interval_days(stage: int) -> int:
    """获取指定阶段对应的间隔天数"""
    if 0 <= stage <= MAX_STAGE:
        return EBBINGHAUS_INTERVALS[stage]
    return EBBINGHAUS_INTERVALS[MAX_STAGE]


def calculate_next_review(stage: int, result: str) -> tuple:
    """
    计算下次复习时间

    参数:
        stage:  当前复习阶段 (0-7)
        result: 复习结果 'pass' 或 'fail'

    返回:
        (new_stage, next_review_datetime, mastered)
    """
    now = datetime.now()

    if result == "pass":
        new_stage = stage + 1
        if new_stage > MAX_STAGE:
            return MAX_STAGE, now + timedelta(days=EBBINGHAUS_INTERVALS[MAX_STAGE]), True
        interval = EBBINGHAUS_INTERVALS[new_stage]
        next_review = now + timedelta(days=interval)
        return new_stage, next_review, False
    else:
        # 失败：重置到阶段0，明天再复习
        return 0, now + timedelta(days=1), False


def get_today_review_tasks(db: Session) -> list:
    """
    查询今日需要复习的单词列表
    """
    now = datetime.now()
    rows = (
        db.query(Collection, Word)
        .join(Word, Collection.word_id == Word.id)
        .filter(Collection.next_review <= now, Collection.mastered == 0)
        .order_by(Collection.next_review.asc())
        .all()
    )

    tasks = []
    for coll, word in rows:
        tasks.append({
            "collection_id": coll.id,
            "word_id": word.id,
            "word": word.word,
            "phonetics_uk": word.phonetics_uk,
            "phonetics_us": word.phonetics_us,
            "audio_uk_url": word.audio_uk_url,
            "audio_us_url": word.audio_us_url,
            "definitions": json.loads(word.definitions) if word.definitions else [],
            "examples": json.loads(word.examples) if word.examples else None,
            "stage": coll.review_stage,
            "review_count": coll.review_count,
        })

    return tasks


def get_stage_label(stage: int, mastered: bool = False) -> str:
    """获取复习阶段的文字标签"""
    if mastered:
        return "已掌握"
    if stage <= 2:
        return "短期记忆"
    if stage <= 5:
        return "中期记忆"
    return "长期记忆"


def get_stage_color(stage: int, mastered: bool = False) -> str:
    """获取复习阶段的颜色标识"""
    if mastered:
        return "blue"
    if stage <= 2:
        return "red"
    if stage <= 5:
        return "orange"
    return "green"
