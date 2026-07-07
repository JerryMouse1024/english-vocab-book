"""数据库连接与初始化"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'vocab_book.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db():
    """初始化数据库表 + 迁移"""
    from app.models import Word, Collection, ReviewRecord, SentenceCollection, SentenceReviewRecord  # noqa
    import sqlite3

    Base.metadata.create_all(bind=engine)

    # 手动迁移：给已存在的 sentence_collections 表添加复习字段
    db_path = os.path.join(BASE_DIR, 'vocab_book.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 检查并添加缺失的列
    cursor.execute("PRAGMA table_info(sentence_collections)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    new_columns = {
        "review_stage": "INTEGER NOT NULL DEFAULT 0",
        "next_review": "DATETIME NOT NULL DEFAULT '2000-01-01 00:00:00'",
        "review_count": "INTEGER NOT NULL DEFAULT 0",
        "mastered": "INTEGER NOT NULL DEFAULT 0",
    }

    for col_name, col_def in new_columns.items():
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE sentence_collections ADD COLUMN {col_name} {col_def}")

    # 将 next_review 默认值修正为当前时间（仅对刚添加的列）
    if any(c not in existing_cols for c in new_columns):
        from datetime import datetime
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor.execute(f"UPDATE sentence_collections SET next_review = ? WHERE next_review = '2000-01-01 00:00:00'", (now_str,))

    conn.commit()
    conn.close()


def get_db():
    """FastAPI 依赖注入：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
