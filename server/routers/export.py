import io
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Novel, Chapter

router = APIRouter(prefix="/novels/{novel_id}/export", tags=["export"])


@router.get("/txt")
def export_txt(novel_id: int, db: Session = Depends(get_db)):
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")

    chapters = db.query(Chapter).filter(Chapter.novel_id == novel_id).order_by(Chapter.id).all()

    lines = []
    lines.append(novel.title)
    lines.append("=" * len(novel.title) * 2)
    if novel.genre:
        lines.append(f"类型：{novel.genre}")
    if novel.synopsis:
        lines.append(f"简介：{novel.synopsis}")
    lines.append("")
    lines.append("")

    for i, ch in enumerate(chapters, 1):
        if ch.title:
            lines.append(f"第{i}章 {ch.title}")
        else:
            lines.append(f"第{i}章")
        lines.append("")
        if ch.content:
            lines.append(ch.content.strip())
        lines.append("")
        lines.append("")

    content = "\n".join(lines)
    filename = re.sub(r'[^\w\u4e00-\u9fff]', '_', novel.title) or 'novel'

    return StreamingResponse(
        io.BytesIO(content.encode('utf-8')),
        media_type='text/plain; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}.txt"'}
    )


@router.get("/epub")
def export_epub(novel_id: int, db: Session = Depends(get_db)):
    try:
        from ebooklib import epub
    except ImportError:
        raise HTTPException(500, "请安装 ebooklib: pip install ebooklib")

    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")

    chapters = db.query(Chapter).filter(Chapter.novel_id == novel_id).order_by(Chapter.id).all()

    book = epub.EpubBook()
    book.set_title(novel.title)
    book.set_language('zh')

    # Add metadata
    if novel.genre:
        book.add_metadata('DC', 'subject', novel.genre)
    book.add_metadata('DC', 'description', novel.synopsis or '')
    book.add_author('NovelForge')

    # Style
    style = '''
    body { font-family: serif; line-height: 1.8; margin: 1em; }
    h1 { text-align: center; margin-bottom: 1em; }
    h2 { margin-top: 2em; page-break-before: always; }
    p { text-indent: 2em; margin: 0.5em 0; }
    '''
    nav_css = epub.EpubItem(
        uid="style_nav",
        file_name="style/nav.css",
        media_type="text/css",
        content=style.encode('utf-8'),
    )
    book.add_item(nav_css)

    # Cover / intro page
    intro_html = f'''
    <html><body>
    <h1>{novel.title}</h1>
    <p>{novel.synopsis or ""}</p>
    </body></html>
    '''
    intro = epub.EpubHtml(title='简介', file_name='intro.xhtml', lang='zh')
    intro.content = intro_html.encode('utf-8')
    intro.add_item(nav_css)
    book.add_item(intro)

    # Chapters
    epub_chapters = [intro]
    toc = [epub.Link('intro.xhtml', '简介', 'intro')]

    for i, ch in enumerate(chapters, 1):
        title = ch.title or f'第{i}章'
        # Convert plain text to HTML paragraphs
        paragraphs = ''
        if ch.content:
            for p in ch.content.strip().split('\n'):
                p = p.strip()
                if p:
                    paragraphs += f'<p>{p}</p>\n'

        html = f'''<html><body>
        <h2>{title}</h2>
        {paragraphs}
        </body></html>'''

        fname = f'chapter_{i}.xhtml'
        epub_ch = epub.EpubHtml(title=title, file_name=fname, lang='zh')
        epub_ch.content = html.encode('utf-8')
        epub_ch.add_item(nav_css)
        book.add_item(epub_ch)
        epub_chapters.append(epub_ch)
        toc.append(epub.Link(fname, title, f'ch{i}'))

    # Navigation
    book.toc = toc
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ['nav'] + epub_chapters

    # Write to buffer
    buffer = io.BytesIO()
    epub.write_epub(buffer, book, {})
    buffer.seek(0)

    filename = re.sub(r'[^\w\u4e00-\u9fff]', '_', novel.title) or 'novel'
    return StreamingResponse(
        buffer,
        media_type='application/epub+zip',
        headers={'Content-Disposition': f'attachment; filename="{filename}.epub"'}
    )


@router.get("/json")
def export_json(novel_id: int, db: Session = Depends(get_db)):
    """Export all novel data as JSON for backup."""
    novel = db.query(Novel).filter(Novel.id == novel_id).first()
    if not novel:
        raise HTTPException(404, "Novel not found")

    from ..models import Character, WorldElement, OutlineNode, PlotThread, Foreshadow, PromptTemplate, AIConfig
    import json
    from datetime import datetime

    def serialize(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return str(obj)

    data = {
        'novel': {c.name: getattr(novel, c.name) for c in novel.__table__.columns},
        'characters': [{c.name: getattr(ch, c.name) for c in ch.__table__.columns} for ch in novel.characters],
        'world_elements': [{c.name: getattr(e, c.name) for c in e.__table__.columns} for e in novel.world_elements],
        'outline_nodes': [{c.name: getattr(n, c.name) for c in n.__table__.columns} for n in novel.outline_nodes],
        'plot_threads': [{c.name: getattr(t, c.name) for c in t.__table__.columns} for t in novel.plot_threads],
        'chapters': [{c.name: getattr(ch, c.name) for c in ch.__table__.columns} for ch in novel.chapters],
        'foreshadows': [{c.name: getattr(f, c.name) for c in f.__table__.columns} for f in novel.foreshadows],
        'prompt_templates': [{c.name: getattr(t, c.name) for c in t.__table__.columns} for t in novel.prompt_templates],
    }

    if novel.ai_config:
        data['ai_config'] = {c.name: getattr(novel.ai_config, c.name) for c in novel.ai_config.__table__.columns}

    content = json.dumps(data, default=serialize, ensure_ascii=False, indent=2)
    filename = re.sub(r'[^\w\u4e00-\u9fff]', '_', novel.title) or 'novel'

    return StreamingResponse(
        io.BytesIO(content.encode('utf-8')),
        media_type='application/json; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}_backup.json"'}
    )
