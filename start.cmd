@echo off
chcp 65001 >nul
set PYTHONUTF8=1

:: 始终保持前端依赖最新
cd /d %~dp0frontend
echo 正在检查前端依赖...
call npm install
echo 正在构建前端...
call npm run build

:: 启动后端（后端会同时托管前端页面）
cd /d %~dp0backend
python run.py || pause
