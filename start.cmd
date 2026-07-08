@echo off
chcp 65001 >nul
set PYTHONUTF8=1

:: === 有道智云翻译 API 密钥（可选，不填则自动降级到百度/MyMemory）===
:: 从 https://ai.youdao.com 注册获取
::   set YOUDAO_APP_KEY=你的应用ID
::   set YOUDAO_APP_SECRET=你的应用密钥
set YOUDAO_APP_KEY=456e46676a7cd30f
set YOUDAO_APP_SECRET=vRkQwMy3OslxOpu6lngcODjZ6CoFdM9z

:: 始终保持前端依赖最新
cd /d %~dp0frontend
echo 正在检查前端依赖...
call npm install
echo 正在构建前端...
call npm run build

:: 启动后端（后端会同时托管前端页面）
cd /d %~dp0backend
python run.py || pause
