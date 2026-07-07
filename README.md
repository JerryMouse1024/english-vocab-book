# 英语单词本 📖

一个基于 Web 的英语学习工具，支持单词查询、句子分析、收藏管理和基于艾宾浩斯遗忘曲线的科学复习系统。

## 功能特性

- **单词查询**：输入英文单词，获取完整释义（音标、发音、中英释义、词形变化、词组、近义词、双语例句）
- **句子分析**：输入英语句子，自动拆解句中单词并逐一查询释义
- **发音播放**：支持英式/美式真人发音
- **收藏管理**：一键收藏单词或句子到个人单词本
- **科学复习**：基于艾宾浩斯遗忘曲线的间隔复习系统，自动生成每日复习任务

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite + React Router |
| 后端 | Python FastAPI |
| 数据库 | SQLite |
| 词典API | UAPI (免费) |

## 环境要求

> 本项目需要本机先装好 **Python** 和 **Node.js** 两个运行环境，下面"安装依赖"是在这二者已具备的前提下的步骤。全新电脑请先完成本节。

### 1. 安装 Python（后端运行环境）

1. 前往 https://www.python.org/downloads/ 下载 Windows 安装包；
2. 运行安装程序时**务必勾选 "Add Python to PATH"**（否则 CMD 里敲 `python` 会提示"不是内部或外部命令"）；
3. 安装完成后**重新打开一个 CMD**，验证：

```cmd
python --version
```

能看到 `Python 3.11.x` 之类版本号即安装成功。（若 `python` 提示找不到，可试 `py --version`，这是 Python 启动器。）

### 2. 安装 Node.js（前端构建环境）

> 项目用的是 **Vite 8**，它对 Node 版本有硬性下限要求（`engines.node: ^20.19.0 || >=22.12.0`），装错版本 `npm run build` 会直接报错。

**推荐版本（二选一）：**

- ✅ **Node.js 22 LTS（≥22.12）** —— 首选，与 React 19 + Vite 8 兼容性最佳
- ✅ Node.js 20 LTS（≥20.19）—— 也满足要求，但已接近 EOL，新机器建议直接上 22

**不要装：** Node 23 / 24 等奇数非 LTS 版（不稳定），以及任何 < 20.19 的旧版。

安装步骤：

1. 前往 https://nodejs.org/ 下载上述 **LTS 版本** 安装包；
2. 默认安装即可，安装程序会自动把 `node` / `npm` 加入 PATH；
3. 安装完成后**重新打开一个 CMD**，验证：

```cmd
node --version
npm --version
```

能看到 `v22.x` 之类、且主版本 ≥ 22.12（或 20.19）即安装成功。（`npm` 随 Node.js 一同安装，前端构建依赖它。）

## 快速启动

> 本项目前后端整合在**同一端口 8000**：后端会自动托管前端页面，**无需单独启动前端**。

### 方式一：一键启动（Windows 推荐）

项目根目录已提供 `start.cmd`，双击即可启动（已内置 UTF-8 编码设置，避免中文乱码）：

```cmd
start.cmd
```

`start.cmd` 会在依赖缺失时自动 `npm install`，并**每次都重新构建前端**（`npm run build`，通常不到 1 秒），确保你拉取的最新代码改动都能生效，然后启动后端。

> ⚠️ **首次运行前必须先把 Python 依赖装好**（见下方「方式二 · 第一步」）。`start.cmd` 只负责前端依赖和启动，**不会安装 Python 依赖**；未安装就双击会报 `ModuleNotFoundError`。依赖只需装一次。

### 方式二：手动启动

**第一步：安装 Python 依赖（只需执行一次，前提是已完成上方「环境要求」中的 Python 安装）**

```bash
cd backend
pip install -r requirements.txt
```

如果 `pip` 不在 PATH，或 Linux 提示环境受限（externally-managed），可用下面这条等价命令：

```bash
python -m pip install --break-system-packages fastapi uvicorn sqlalchemy httpx pydantic
```

> - Windows 上 Python 命令通常是 `python`（不是 `python3.11`，那是 Linux/macOS 写法）；若 `python` 找不到，试 `py -m pip ...`（Python 启动器）。
> - `--break-system-packages` 主要用于 Linux 受限环境；Windows 通常不加也能装，但加上无害。
> - 启动项目本身**不需要**重复安装依赖，只有首次或依赖缺失时才装。

**第二步：构建前端（只需在首次或前端代码改动后执行）**

```bash
cd frontend
npm install
npm run build
```

> `frontend/dist/` 不纳入 git 版本管理，从仓库拉取后本地没有该目录，必须构建一次才能访问网页。

**第三步：启动**

```bash
cd backend
python run.py
```

后端运行在 http://localhost:8000 ，浏览器直接访问该地址即可使用（后端同时提供 API 与前端页面）。

### Windows 终端中文乱码解决办法

旧版 CMD 默认用 GBK 显示，而 Python 输出 UTF-8，会出现乱码（仅影响终端显示，不影响网页内容）。三种办法：

1. 用项目自带的 `start.cmd`（已处理编码）；
2. 启动前执行 `chcp 65001` 并 `set PYTHONUTF8=1`；
3. 改用 **Windows Terminal** 或 **PowerShell**，原生支持 UTF-8。

## API 文档

启动后端后访问 http://localhost:8000/docs 查看 Swagger 文档。

## 艾宾浩斯复习算法

| 阶段 | 间隔 | 说明 |
|------|------|------|
| 0 | 当天 | 刚收藏，立即复习 |
| 1 | 1天 | |
| 2 | 2天 | |
| 3 | 4天 | |
| 4 | 7天 | |
| 5 | 15天 | |
| 6 | 30天 | |
| 7 | 90天 | 最后一轮 |

- 复习通过 → 进入下一阶段，间隔递增
- 复习失败 → 重置到阶段0，明天重新开始
- 完成全部7阶段 → 标记为"已掌握"
