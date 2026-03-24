# NovelForge — AI 小说创作工坊

> 结构化管理你的小说大纲、角色、世界观与剧情线，在 AI 写作时智能组装上下文，告别遗忘。

## 核心问题

AI 写小说时上下文窗口有限，无法同时记住大量信息。NovelForge 将小说的各个维度结构化存储，在调用 AI 写作时**智能组装相关上下文**，让 AI 始终拥有完整的故事记忆。

## 功能

- **大纲管理** — 树状结构（卷 → 篇 → 章 → 场），支持摘要、备注、状态追踪
- **角色系统** — 详细的角色档案（性格、外貌、背景、目标、弧线、说话风格）+ 角色关系
- **世界观设定** — 地点、组织、规则、历史、物品、文化、魔法体系、科技等分类管理
- **剧情线追踪** — 主线/支线/悬疑/感情线/冲突，状态追踪（铺垫→发展→高潮→解决）
- **AI 写作** — 智能上下文组装 + OpenAI 兼容 API 调用，生成结果可直接采纳/追加
- **上下文预览** — 调用 AI 前可预览将要发送的完整上下文

## 快速开始

```bash
pip install -r requirements.txt
python3 -m uvicorn server.app:app --host 0.0.0.0 --port 8000
```

打开浏览器访问 `http://localhost:8000`

## 技术栈

- **后端**: Python + FastAPI + SQLAlchemy + SQLite
- **前端**: 原生 HTML/CSS/JS（零依赖，极致轻量）
- **AI**: OpenAI 兼容 API（支持自定义 endpoint）

## 项目结构

```
├── server/
│   ├── app.py          # FastAPI 应用入口
│   ├── database.py     # 数据库连接
│   ├── models.py       # 数据模型
│   ├── schemas.py      # API 数据结构
│   ├── context.py      # 智能上下文组装
│   └── routers/        # API 路由
│       ├── novels.py
│       ├── characters.py
│       ├── relationships.py
│       ├── world.py
│       ├── outline.py
│       ├── plots.py
│       ├── chapters.py
│       ├── ai_config.py
│       └── ai_write.py
├── web/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── requirements.txt
└── run.sh
```
