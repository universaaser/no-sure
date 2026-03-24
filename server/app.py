from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import init_db
from .routers import novels, characters, relationships, world, outline, plots, chapters, ai_config, ai_write
from .routers import versions, export, foreshadows, templates, consistency

app = FastAPI(title="NovelForge", description="AI 小说创作管理系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(novels.router)
app.include_router(characters.router)
app.include_router(relationships.router)
app.include_router(world.router)
app.include_router(outline.router)
app.include_router(plots.router)
app.include_router(chapters.router)
app.include_router(ai_config.router)
app.include_router(ai_write.router)
app.include_router(versions.router)
app.include_router(export.router)
app.include_router(foreshadows.router)
app.include_router(templates.router)
app.include_router(consistency.router)

# Serve static files
web_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web")
app.mount("/static", StaticFiles(directory=web_dir), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(web_dir, "index.html"))


@app.on_event("startup")
def startup():
    init_db()
