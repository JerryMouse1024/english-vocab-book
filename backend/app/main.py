"""FastAPI 应用入口 — 同时托管前端静态文件和 API"""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.database import init_db
from app.routers import words, review, sentences

app = FastAPI(
    title="英语单词本 API",
    description="支持单词查询、收藏、艾宾浩斯记忆曲线复习",
    version="1.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 前端静态文件目录
# main.py -> app/ -> backend/ -> english-vocab-book/ -> frontend/dist/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_PROJECT_DIR = os.path.dirname(_BACKEND_DIR)
FRONTEND_DIST = os.path.join(_PROJECT_DIR, "frontend", "dist")

# 先挂载静态资源
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


# 注册 API 路由（必须在 SPA fallback 之前）
app.include_router(words.router)
app.include_router(review.router)
app.include_router(sentences.router)


@app.get("/")
async def serve_index():
    """根路径返回前端首页"""
    index_path = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "英语单词本 API 服务运行中", "docs": "/docs"}


@app.get("/{path:path}")
async def serve_spa(path: str):
    """SPA fallback：非 API 路径返回前端页面"""
    # API 路径由 routers 处理，这里只处理前端路由
    file_path = os.path.join(FRONTEND_DIST, path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    # SPA fallback
    index_path = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"detail": "Not Found"}


@app.on_event("startup")
def on_startup():
    init_db()
