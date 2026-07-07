@echo off
chcp 65001 >nul
set PYTHONUTF8=1

:: 前端依赖缺失则安装；之后每次都重新构建，确保代码改动生效
cd /d %~dp0frontend
if not exist "node_modules" (
    echo 未检测到前端依赖，正在安装...
    call npm install
)
echo 正在构建前端...
call npm run build

:: 启动后端（后端会同时托管前端页面）
cd /d %~dp0backend
python run.py || pause
