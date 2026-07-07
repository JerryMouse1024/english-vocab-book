@echo off
chcp 65001 >nul
set PYTHONUTF8=1

:: 前端未构建则自动安装依赖并构建（dist/ 不进 git，需本地生成）
cd /d %~dp0frontend
if not exist "dist" (
    echo 未检测到前端构建产物，正在安装依赖并构建...
    call npm install
    call npm run build
) else (
    echo 前端已构建，跳过构建步骤。
)

:: 启动后端（后端会同时托管前端页面）
cd /d %~dp0backend
python run.py
