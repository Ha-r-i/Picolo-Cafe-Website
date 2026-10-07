"""Render the Markdown handbook to PDF and per-page PNGs for visual review."""

from __future__ import annotations

import json
import re
import sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.local-backup' / 'guide-python'))

import pymupdf
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Line, Polygon, Rect, String
from reportlab.platypus import (
    BaseDocTemplate, CondPageBreak, Frame, Image, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle, XPreformatted,
)
from reportlab.platypus.tableofcontents import TableOfContents

FONT = 'Helvetica'
BOLD = 'Helvetica-Bold'
ITALIC = 'Helvetica-Oblique'
MONO = 'Courier'
font_root = Path('C:/Windows/Fonts')
if (font_root / 'calibri.ttf').exists():
    for name, file in [('Guide', 'calibri.ttf'), ('GuideBold', 'calibrib.ttf'),
                       ('GuideItalic', 'calibrii.ttf')]:
        pdfmetrics.registerFont(TTFont(name, str(font_root / file)))
    FONT, BOLD, ITALIC = 'Guide', 'GuideBold', 'GuideItalic'
    pdfmetrics.registerFontFamily('Guide', normal=FONT, bold=BOLD, italic=ITALIC, boldItalic=BOLD)
if (font_root / 'consola.ttf').exists():
    pdfmetrics.registerFont(TTFont('GuideMono', str(font_root / 'consola.ttf')))
    MONO = 'GuideMono'

INK = colors.HexColor('#202B36')
BLUE = colors.HexColor('#2E74B5')
DARK = colors.HexColor('#1F4D78')
MUTED = colors.HexColor('#596775')
FILL = colors.HexColor('#F2F4F7')
EDGE = colors.HexColor('#D8DFE6')
WIDTH = 468

STYLES = {
    'body': ParagraphStyle('Body', fontName=FONT, fontSize=11, leading=13.75,
                           textColor=INK, spaceAfter=6, allowWidows=0, allowOrphans=0),
    'chapter': ParagraphStyle('Chapter', fontName=BOLD, fontSize=16, leading=20,
                              textColor=BLUE, spaceBefore=18, spaceAfter=10, keepWithNext=1),
    'sub': ParagraphStyle('Sub', fontName=BOLD, fontSize=13, leading=16,
                          textColor=BLUE, spaceBefore=14, spaceAfter=7, keepWithNext=1),
    'list': ParagraphStyle('List', fontName=FONT, fontSize=11, leading=13.75,
                           textColor=INK, leftIndent=27, firstLineIndent=0,
                           bulletIndent=13.46, spaceAfter=4, allowWidows=0, allowOrphans=0),
    'code': ParagraphStyle('Code', fontName=MONO, fontSize=8.8, leading=11.4,
                           textColor=INK, backColor=FILL, borderPadding=9,
                           spaceBefore=14, spaceAfter=14),
    'cell': ParagraphStyle('Cell', fontName=FONT, fontSize=9.7, leading=12.1,
                           textColor=INK, splitLongWords=1),
    'cellhead': ParagraphStyle('CellHead', fontName=BOLD, fontSize=9.7, leading=12.1,
                               textColor=DARK),
    'caption': ParagraphStyle('Caption', fontName=ITALIC, fontSize=9, leading=12,
                              textColor=MUTED, spaceBefore=4, spaceAfter=10),
    'cover': ParagraphStyle('Cover', fontName=BOLD, fontSize=30, leading=35,
                            alignment=TA_CENTER, textColor=DARK, spaceAfter=12),
    'subtitle': ParagraphStyle('Subtitle', fontName=FONT, fontSize=15, leading=20,
                               alignment=TA_CENTER, textColor=MUTED, spaceAfter=18),
    'kicker': ParagraphStyle('Kicker', fontName=BOLD, fontSize=10, leading=14,
                             alignment=TA_CENTER, textColor=BLUE, spaceAfter=16),
}


def inline(text):
    """Minimal supported Markdown inline syntax with PDF hyperlink annotations."""
    tokens = {}
    def hold(value):
        key = f'@@TOKEN{len(tokens)}@@'
        tokens[key] = value
        return key
    text = re.sub(r'`([^`]+)`', lambda m: hold(
        f'<font name="{MONO}" size="9.4">{escape(m.group(1))}</font>'), text)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', lambda m: hold(
        f'<link href="{escape(m.group(2), quote=True)}" color="#2E74B5">'
        f'{escape(m.group(1))}</link>'), text)
    text = escape(text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    for key, value in tokens.items():
        text = text.replace(key, value)
    return text


def p(text, style='body'):
    return Paragraph(inline(text), STYLES[style])


def box(d, x, y, w, h, title, lines=()):
    d.add(Rect(x, y, w, h, rx=6, ry=6, fillColor=FILL, strokeColor=EDGE))
    d.add(String(x + w/2, y+h-20, title, fontName=BOLD, fontSize=10,
                 textAnchor='middle', fillColor=DARK))
    for i, text in enumerate(lines):
        d.add(String(x+w/2, y+h-36-13*i, text, fontName=FONT, fontSize=9,
                     textAnchor='middle', fillColor=INK))


def arrow(d, x1, y1, x2, y2, label=''):
    d.add(Line(x1, y1, x2, y2, strokeColor=BLUE, strokeWidth=1.25))
    if x2 != x1:
        direction = 1 if x2 > x1 else -1
        points = [x2, y2, x2-6*direction, y2+3, x2-6*direction, y2-3]
    else:
        direction = 1 if y2 > y1 else -1
        points = [x2, y2, x2-3, y2-6*direction, x2+3, y2-6*direction]
    d.add(Polygon(points, fillColor=BLUE, strokeColor=BLUE))
    if label:
        d.add(String((x1+x2)/2, (y1+y2)/2+7, label, fontName=FONT, fontSize=8,
                     textAnchor='middle', fillColor=MUTED))


def architecture():
    d = Drawing(WIDTH, 258)
    box(d, 0, 176, 140, 76, 'React browser', ['Forms + session', 'localhost:3000'])
    box(d, 186, 176, 140, 76, 'Fastify API', ['Rules + permissions', 'localhost:3001'])
    box(d, 186, 45, 140, 76, 'PostgreSQL', ['Capacity + audit + outbox', 'localhost:54322'])
    box(d, 368, 181, 100, 66, 'Auth / Storage', ['Supabase HTTP', 'localhost:54321'])
    box(d, 0, 45, 140, 76, 'Email worker', ['Claim + retry + receipt', 'Optional Resend'])
    arrow(d, 140, 211, 186, 211, '/api')
    arrow(d, 326, 211, 368, 211)
    arrow(d, 256, 176, 256, 121)
    arrow(d, 186, 83, 140, 83, 'jobs')
    d.add(String(0, 10, 'Browser also contacts Supabase Auth directly for account sessions.',
                 fontName=FONT, fontSize=9, fillColor=MUTED))
    d.scale(0.86, 0.86)
    d.width *= 0.86
    d.height *= 0.86
    d.hAlign = 'CENTER'
    return d


def booking():
    d = Drawing(WIDTH, 229)
    for x, title in [(59, 'Browser'), (224, 'API'), (401, 'PostgreSQL')]:
        d.add(String(x, 214, title, fontName=BOLD, fontSize=11,
                     textAnchor='middle', fillColor=DARK))
        d.add(Line(x, 199, x, 12, strokeColor=EDGE, strokeDashArray=[3, 3]))
    arrow(d, 59, 181, 224, 181, 'POST + key + details')
    arrow(d, 224, 143, 401, 143, 'validated create_booking')
    d.add(String(299, 119, 'Lock, rules, peak, inserts', fontName=FONT, fontSize=9, fillColor=INK))
    d.add(String(299, 102, 'Audit + outbox + retry result', fontName=FONT, fontSize=9, fillColor=INK))
    arrow(d, 401, 77, 224, 77, 'commit or rollback')
    arrow(d, 224, 39, 59, 39, '201 new / 200 replay')
    return d


def states():
    d = Drawing(WIDTH, 191)
    box(d, 0, 120, 105, 64, 'pending')
    box(d, 172, 120, 110, 64, 'confirmed')
    box(d, 348, 120, 120, 64, 'seated')
    box(d, 0, 10, 105, 64, 'rejected')
    box(d, 172, 10, 110, 64, 'cancelled', ['from pending/confirmed'])
    box(d, 348, 10, 120, 64, 'completed')
    arrow(d, 105, 153, 172, 153, 'staff')
    arrow(d, 282, 153, 348, 153, 'after start')
    arrow(d, 52, 120, 52, 74)
    arrow(d, 227, 120, 227, 74)
    arrow(d, 408, 120, 408, 74)
    return d


def data():
    d = Drawing(WIDTH, 260)
    box(d, 0, 183, 123, 70, 'auth.users', ['Supabase account'])
    box(d, 174, 183, 120, 70, 'profiles', ['DB-owned role'])
    box(d, 0, 52, 123, 70, 'reservations', ['visit + status + version'])
    box(d, 174, 52, 120, 70, 'audit / outbox', ['history / delivery work'])
    box(d, 346, 183, 122, 70, 'categories', ['menu grouping'])
    box(d, 346, 52, 122, 70, 'menu_items', ['price + image + publish'])
    arrow(d, 123, 218, 174, 218, '1 : 1')
    arrow(d, 61, 183, 61, 122)
    arrow(d, 123, 87, 174, 87, '1 : many')
    arrow(d, 407, 183, 407, 122)
    d.add(String(0, 19, 'Reservation ownership is optional; guest hashes and retry results are private.',
                 fontName=FONT, fontSize=9, fillColor=MUTED))
    return d


DIAGRAMS = {'architecture': architecture, 'booking': booking, 'states': states, 'data': data}


class Handbook(BaseDocTemplate):
    def beforeDocument(self):
        self.heading_count = 0

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == 'Chapter':
            self.heading_count += 1
            text = flowable.getPlainText()
            key = f'chapter-{self.heading_count}'
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, 0, False)
            self.notify('TOCEntry', (0, text, self.page, key))


def furniture(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont(FONT, 8.5)
    if doc.page > 1:
        canvas.drawString(72, 755, 'PICCOLO CAFE  /  PROJECT HANDBOOK')
        canvas.drawRightString(540, 755, 'Run · Understand · Explain')
    canvas.drawString(72, 37, 'Upgrade branch · 8 October 2026')
    canvas.drawRightString(540, 37, f'Page {doc.page}')
    canvas.restoreState()


def build_story(source):
    story = [Spacer(1, 30), p('PICCOLO CAFE', 'kicker'),
             Paragraph('Run it.<br/>Understand it.<br/>Explain it.', STYLES['cover']),
             Paragraph('A practical project handbook<br/>Windows setup + complete workflow tour', STYLES['subtitle'])]
    photo = ROOT / 'public/images/cafe-1200.webp'
    if photo.exists():
        image = Image(str(photo), width=WIDTH, height=220, kind='proportional')
        image.hAlign = 'CENTER'
        story.extend([image, Spacer(1, 18)])
    story.append(p('Built from the actual React, Fastify and Supabase upgrade. '
                   'Includes setup commands, four diagrams, code paths, test evidence, '
                   'troubleshooting and an interview study sequence.'))
    story.append(p('Original production data and live deployment remain unchanged.', 'caption'))
    story.append(PageBreak())
    story.append(p('Contents', 'sub'))
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle('TOC', fontName=FONT, fontSize=10.2, leading=12,
                                     spaceBefore=1, spaceAfter=1, textColor=INK)]
    toc.tableStyle = TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                 ('LEFTPADDING', (0, 0), (-1, -1), 0),
                                 ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                                 ('TOPPADDING', (0, 0), (-1, -1), 1),
                                 ('BOTTOMPADDING', (0, 0), (-1, -1), 2)])
    story.extend([toc, PageBreak()])
    lines = source.splitlines()
    i = next(index for index, line in enumerate(lines) if line.startswith('## '))
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith('# '):
            i += 1
            continue
        if line.startswith('## '):
            if story and not isinstance(story[-1], PageBreak):
                story.append(CondPageBreak(210))
            story.append(p(line[3:], 'chapter'))
            i += 1
            continue
        if line.startswith('### '):
            story.append(p(line[4:], 'sub'))
            i += 1
            continue
        if line.startswith('<!-- diagram:'):
            key = line.split(':', 1)[1].split()[0]
            story.append(DIAGRAMS[key]())
            story.append(Spacer(1, 9))
            i += 1
            continue
        if line.startswith('```'):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                code.append(lines[i])
                i += 1
            # Code blocks never wrap commands invisibly; fail if a source line is too wide.
            for text in code:
                if pdfmetrics.stringWidth(text, MONO, 8.8) > WIDTH-18:
                    raise ValueError(f'Code line too wide: {text}')
            block = XPreformatted(escape('\n'.join(code)), STYLES['code'])
            story.append(block)
            i += 1
            continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', x) for x in cells):
                    rows.append(cells)
                i += 1
            count = len(rows[0])
            col_widths = [110, 177, 181] if count == 3 else [190, 278]
            if rows[0][0] == 'File or area':
                col_widths = [248, 220]
            cells = [[p(cell, 'cellhead' if index == 0 else 'cell') for cell in row]
                     for index, row in enumerate(rows)]
            table = Table(cells, colWidths=col_widths, repeatRows=1, hAlign='LEFT')
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), FILL),
                ('GRID', (0, 0), (-1, -1), 0.4, EDGE),
                ('LEFTPADDING', (0, 0), (-1, -1), 6),
                ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.extend([table, Spacer(1, 11)])
            continue
        ordered = re.match(r'^(\d+)\.\s+(.*)', line)
        if line.startswith('- ') or ordered:
            text = ordered.group(2) if ordered else line[2:]
            marker = f'{ordered.group(1)}.' if ordered else '•'
            story.append(Paragraph(inline(text), STYLES['list'], bulletText=marker))
            i += 1
            continue
        paragraph = [line]
        i += 1
        while i < len(lines) and lines[i].strip() and not re.match(
                r'^(#{1,3} |```|\||- |\d+\. |<!--)', lines[i].strip()):
            paragraph.append(lines[i].strip())
            i += 1
        story.append(p(' '.join(paragraph)))
    return story


def main():
    output = ROOT / 'docs/Piccolo-Cafe-Run-and-Understand.pdf'
    source = (ROOT / 'docs/run-and-understand.md').read_text(encoding='utf-8')
    doc = Handbook(str(output), pagesize=letter, leftMargin=72, rightMargin=72,
                   topMargin=72, bottomMargin=72, title='Piccolo Cafe: Run and Understand',
                   author='Piccolo Cafe project', subject='Setup, workflows and interview guide')
    doc.addPageTemplates(PageTemplate(id='guide',
        frames=Frame(72, 72, WIDTH, 648, leftPadding=0, rightPadding=0,
                     topPadding=0, bottomPadding=0), onPage=furniture))
    doc.multiBuild(build_story(source))
    render_dir = ROOT / '.local-backup/guide-render'
    render_dir.mkdir(parents=True, exist_ok=True)
    pdf = pymupdf.open(output)
    pages = []
    problems = []
    for index, page in enumerate(pdf):
        page.get_pixmap(dpi=150).save(render_dir / f'page-{index+1:02}.png')
        text = page.get_text()
        pages.append({'page': index+1, 'characters': len(text),
                      'links': len(page.get_links()), 'first_line': text.splitlines()[0]})
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                for span in line['spans']:
                    x0, y0, x1, y1 = span['bbox']
                    if x0 < 68 or x1 > 544 or y0 < 24 or y1 > 770:
                        problems.append({'page': index+1, 'bbox': span['bbox'], 'text': span['text']})
        if '\ufffd' in text:
            problems.append({'page': index+1, 'problem': 'replacement glyph'})
    audit = {'pdf': str(output), 'pages': pages, 'bookmarks': len(pdf.get_toc()),
             'layout_problems': problems}
    (render_dir / 'audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
    (render_dir / 'extracted.txt').write_text('\n\n'.join(page.get_text() for page in pdf), encoding='utf-8')
    print(json.dumps({'pdf': str(output), 'pages': len(pdf), 'bookmarks': len(pdf.get_toc()),
                      'layout_problems': len(problems), 'render_dir': str(render_dir)}))
    if problems:
        raise SystemExit('Review audit.json and fix layout before delivering.')


if __name__ == '__main__':
    main()
