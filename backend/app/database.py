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

    # SQLite 要求非空列有常量默认值，用哨兵值 2000-01-01 标记
    SENTINEL = "2000-01-01 00:00:00"
    new_columns = {
        "review_stage": "INTEGER NOT NULL DEFAULT 0",
        "next_review": f"DATETIME NOT NULL DEFAULT '{SENTINEL}'",
        "review_count": "INTEGER NOT NULL DEFAULT 0",
        "mastered": "INTEGER NOT NULL DEFAULT 0",
    }

    added_any = False
    for col_name, col_def in new_columns.items():
        if col_name not in existing_cols:
            cursor.execute(f"ALTER TABLE sentence_collections ADD COLUMN {col_name} {col_def}")
            added_any = True

    # 每次启动都修复残留的哨兵值为当前时间（幂等，安全）
    from datetime import datetime
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    cursor.execute(
        f"UPDATE sentence_collections SET next_review = ? WHERE next_review = ?",
        (now_str, SENTINEL),
    )
    fixed_rows = cursor.rowcount

    conn.commit()
    conn.close()

    if added_any or fixed_rows > 0:
        print(f"[DB迁移] 已为 sentence_collections 补充复习字段" +
              (f"，修正了 {fixed_rows} 条记录的 next_review" if fixed_rows > 0 else ""))


def get_db():
    """FastAPI 依赖注入：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
