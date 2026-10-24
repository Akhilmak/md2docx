// Markdown tokens -> native Word document (styles, numbering, real tables) via docx.js.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, AlignmentType, LevelFormat, ImageRun, UnderlineType,
  convertMillimetersToTwip,
} from 'docx';
import { lex, safeUrl, isAbsoluteLink } from './markdown.js';
import { mermaidToPngBuffer } from './mermaid-render.js';
import { texToPngBuffer } from './latex-render.js';

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
const hex = (c) => c.replace('#', '').toUpperCase();
const half = (pt) => Math.round(pt * 2);
const twip = (pt) => Math.round(pt * 20);
const mmTw = (mm) => Math.round(convertMillimetersToTwip(mm));
const LIST_INDENT = 720;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

let decoder;
function decode(s) {
  if (!s.includes('&')) return s;
  decoder ||= document.createElement('textarea');
  decoder.innerHTML = s;
  return decoder.value;
}

export async function buildDocx(markdown, st, { title = 'Document' } = {}) {
  const tokens = lex(markdown);
  const ctx = { st, warnings: new Set(), numbering: [], images: new Map() };
  await loadImages(tokens, ctx);

  const children = blocks(tokens, ctx, { quote: 0, listLevel: -1, indent: 0 });
  if (!children.length) children.push(new Paragraph({}));

  const doc = new Document({
    title,
    creator: 'md2docx',
    styles: docStyles(st),
    numbering: { config: [bulletConfig(), ...ctx.numbering] },
    sections: [{
      properties: {
        page: {
          size: { width: mmTw(st.page.widthMm), height: mmTw(st.page.heightMm) },
          margin: Object.fromEntries(['top', 'right', 'bottom', 'left'].map((k) => [k, mmTw(st.marginCm * 10)])),
        },
      },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  return { blob, warnings: [...ctx.warnings] };
}

function docStyles(st) {
  const heading = (i) => ({
    run: { font: st.bodyFont, size: half(st.headingSizes[i]), bold: true, italics: i === 5, color: hex(st.headingColor) },
    paragraph: {
      spacing: { before: twip(i < 2 ? 18 : 12), after: twip(6) },
      keepNext: true,
      keepLines: true,
      ...(st.headingRule && i < 2
        ? { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: hex(st.headingColor), space: 2 } } }
        : {}),
    },
  });
  const codeBorder = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 };
  return {
    default: {
      document: {
        run: { font: st.bodyFont, size: half(st.fontSize) },
        paragraph: { spacing: { after: twip(st.paraAfterPt), line: Math.round(240 * st.lineSpacing) } },
      },
      ...Object.fromEntries(HEADINGS.map((_, i) => [`heading${i + 1}`, heading(i)])),
      hyperlink: { run: { color: '0563C1', underline: { type: UnderlineType.SINGLE } } },
      listParagraph: { paragraph: { spacing: { after: twip(3) } } },
    },
    paragraphStyles: [
      {
        id: 'MdCode', name: 'Code Block', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: st.codeFont, size: half(st.codeSize) },
        paragraph: {
          spacing: { after: twip(st.paraAfterPt), line: 240 },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(st.codeBg) },
          ...(st.codeBorder ? { border: { top: codeBorder, bottom: codeBorder, left: codeBorder, right: codeBorder } } : {}),
        },
      },
      {
        id: 'MdQuote', name: 'Block Quote', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { italics: true, color: '404040' },
        paragraph: {
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: hex(st.headingColor), space: 8 } },
        },
      },
    ],
  };
}

function levels(formatFor, textFor, start = 1) {
  return Array.from({ length: 9 }, (_, i) => ({
    level: i,
    format: formatFor(i),
    text: textFor(i),
    start: i === 0 ? start : 1,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: LIST_INDENT * (i + 1), hanging: 360 } } },
  }));
}

function bulletConfig() {
  const chars = ['•', '◦', '▪'];
  return { reference: 'md-bullet', levels: levels(() => LevelFormat.BULLET, (i) => chars[i % 3]) };
}

function orderedConfig(reference, start) {
  const formats = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];
  return { reference, levels: levels((i) => formats[i % 3], (i) => `%${i + 1}.`, start) };
}

// ---------- images ----------

function walk(tokens, fn) {
  for (const t of tokens || []) {
    fn(t);
    walk(t.tokens, fn);
    if (t.items) t.items.forEach((it) => walk(it.tokens, fn));
    if (t.type === 'table') {
      t.header.forEach((c) => walk(c.tokens, fn));
      t.rows.forEach((r) => r.forEach((c) => walk(c.tokens, fn)));
    }
  }
}

async function loadImages(tokens, ctx) {
  const hrefs = new Set();
  walk(tokens, (t) => { if (t.type === 'image' && safeUrl(t.href)) hrefs.add(t.href); });

  // Collect mermaid code blocks.
  const mermaidSources = new Set();
  walk(tokens, (t) => { if (t.type === 'code' && t.lang && t.lang.trim().toLowerCase() === 'mermaid') mermaidSources.add(t.text); });

  // Collect math blocks and inlines.
  const mathBlocks = new Set();
  const mathInlines = new Set();
  walk(tokens, (t) => {
    if (t.type === 'mathBlock') mathBlocks.add(t.text);
    else if (t.type === 'mathInline') mathInlines.add(t.text);
    else if (t.type === 'code' && t.lang && ['math', 'latex', 'tex'].includes(t.lang.trim().toLowerCase())) {
      mathBlocks.add(t.text.trim());
    }
  });

  await Promise.all([
    ...[...hrefs].map(async (href) => {
      try {
        ctx.images.set(href, await fetchImage(href));
      } catch (e) {
        ctx.warnings.add(`Image not embedded (${e.message}): ${href.slice(0, 80)}`);
      }
    }),
    ...[...mermaidSources].map(async (source) => {
      try {
        const im = await mermaidToPngBuffer(source, ctx.st?.mermaid);
        ctx.images.set(`mermaid:${source}`, { type: 'png', ...im });
      } catch (e) {
        ctx.warnings.add(`Mermaid diagram not embedded (${e.message}).`);
      }
    }),
    ...[...mathBlocks].map(async (tex) => {
      try {
        const im = await texToPngBuffer(tex, true);
        ctx.images.set(`math:block:${tex}`, { type: 'png', ...im });
      } catch (e) {
        ctx.warnings.add(`Math equation not embedded (${e.message}): ${tex.slice(0, 40)}`);
      }
    }),
    ...[...mathInlines].map(async (tex) => {
      try {
        const im = await texToPngBuffer(tex, false);
        ctx.images.set(`math:inline:${tex}`, { type: 'png', ...im });
      } catch (e) {
        ctx.warnings.add(`Inline math not embedded (${e.message}): ${tex.slice(0, 40)}`);
      }
    }),
  ]);
}

async function fetchImage(href) {
  const res = await fetch(href);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let blob = await res.blob();
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('larger than 10 MB');
  const native = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp' }[blob.type];
  const img = await loadImg(blob);
  const w = img.naturalWidth || 300;
  const h = img.naturalHeight || 150;
  if (native) return { type: native, data: await blob.arrayBuffer(), w, h };
  // SVG, WebP and others are converted to PNG, which every Word version reads.
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  blob = await new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('conversion failed'))), 'image/png'));
  return { type: 'png', data: await blob.arrayBuffer(), w, h };
}

function loadImg(blob) {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('unreadable image')); };
    img.src = url;
  });
}

function imageRun(t, ctx, env) {
  const im = ctx.images.get(t.href);
  if (!im) return new TextRun({ text: `[image: ${decode(t.text || t.href)}]`, italics: true });
  const maxW = (ctx.st.contentWidthMm - (env.indent / 1440) * 25.4) * (96 / 25.4);
  const scale = Math.min(1, maxW / im.w);
  return new ImageRun({
    type: im.type,
    data: im.data,
    transformation: { width: Math.round(im.w * scale), height: Math.round(im.h * scale) },
    altText: { name: decode(t.text || 'image'), description: decode(t.text || ''), title: t.title || '' },
  });
}

// ---------- inline ----------

function run(text, fmt, st) {
  return new TextRun({
    text: decode(text).replace(/\n/g, ' '),
    bold: fmt.bold,
    italics: fmt.italics,
    strike: fmt.strike,
    style: fmt.link ? 'Hyperlink' : undefined,
    ...(fmt.code ? {
      font: st.codeFont,
      size: half(st.codeSize),
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(st.codeBg === '#FFFFFF' ? '#F2F2F2' : st.codeBg) },
    } : {}),
  });
}

function inlines(tokens, ctx, env, fmt = {}) {
  const out = [];
  for (const t of tokens || []) {
    switch (t.type) {
      case 'text':
        if (t.tokens) out.push(...inlines(t.tokens, ctx, env, fmt));
        else out.push(run(t.text, fmt, ctx.st));
        break;
      case 'escape': out.push(run(t.text, fmt, ctx.st)); break;
      case 'strong': out.push(...inlines(t.tokens, ctx, env, { ...fmt, bold: true })); break;
      case 'em': out.push(...inlines(t.tokens, ctx, env, { ...fmt, italics: true })); break;
      case 'del': out.push(...inlines(t.tokens, ctx, env, { ...fmt, strike: true })); break;
      case 'codespan': out.push(run(t.text, { ...fmt, code: true }, ctx.st)); break;
      case 'mathInline': {
        const im = ctx.images.get(`math:inline:${t.text}`);
        if (im) {
          out.push(new ImageRun({
            type: 'png',
            data: im.data,
            transformation: { width: Math.round(im.w), height: Math.round(im.h) },
            altText: { name: 'Math formula', description: t.text, title: '' },
          }));
        } else {
          out.push(new TextRun({ text: `$${t.text}$`, italics: true }));
        }
        break;
      }
      case 'br': out.push(new TextRun({ break: 1 })); break;
      case 'image': out.push(imageRun(t, ctx, env)); break;
      case 'link': {
        const href = safeUrl(t.href);
        if (fmt.link || !isAbsoluteLink(href)) {
          out.push(...inlines(t.tokens, ctx, env, fmt));
        } else {
          out.push(new ExternalHyperlink({ link: href, children: inlines(t.tokens, ctx, env, { ...fmt, link: true }) }));
        }
        break;
      }
      case 'html':
        if (/^<br\s*\/?>$/i.test(t.text.trim())) out.push(new TextRun({ break: 1 }));
        else {
          ctx.warnings.add('Raw HTML was kept as plain text.');
          out.push(run(t.text, fmt, ctx.st));
        }
        break;
      default:
        ctx.warnings.add(`Unsupported inline element "${t.type}" kept as plain text.`);
        out.push(run(t.raw || '', fmt, ctx.st));
    }
  }
  return out;
}

// ---------- blocks ----------

function para(children, env, extra = {}) {
  const o = { children, ...extra };
  if (env.quote) {
    o.style = 'MdQuote';
    o.indent = { left: 360 * env.quote + env.indent };
  } else if (env.indent) {
    o.indent = { left: env.indent };
  }
  return new Paragraph(o);
}

function blocks(tokens, ctx, env) {
  const out = [];
  for (const t of tokens || []) {
    switch (t.type) {
      case 'space':
      case 'def':
        break;
      case 'heading':
        out.push(new Paragraph({ heading: HEADINGS[t.depth - 1], children: inlines(t.tokens, ctx, env) }));
        break;
      case 'paragraph':
      case 'text':
        out.push(para(t.tokens ? inlines(t.tokens, ctx, env) : [run(t.text, {}, ctx.st)], env));
        break;
      case 'mathBlock': {
        const im = ctx.images.get(`math:block:${t.text}`);
        if (im) {
          const maxW = (ctx.st.contentWidthMm - (env.indent / 1440) * 25.4) * (96 / 25.4);
          const scale = Math.min(1, maxW / im.w);
          out.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({
              type: 'png',
              data: im.data,
              transformation: { width: Math.round(im.w * scale), height: Math.round(im.h * scale) },
              altText: { name: 'Math formula', description: t.text, title: '' },
            })],
            ...(env.indent ? { indent: { left: env.indent } } : {}),
          }));
        } else {
          out.push(new Paragraph({
            style: 'MdCode',
            children: [new TextRun({ text: `$$ ${t.text} $$` })],
            ...(env.indent ? { indent: { left: env.indent } } : {}),
          }));
        }
        break;
      }
      case 'code': {
        const l = (t.lang || '').trim().toLowerCase();
        // Math/LaTeX code block
        if (['math', 'latex', 'tex'].includes(l)) {
          const im = ctx.images.get(`math:block:${t.text.trim()}`);
          if (im) {
            const maxW = (ctx.st.contentWidthMm - (env.indent / 1440) * 25.4) * (96 / 25.4);
            const scale = Math.min(1, maxW / im.w);
            out.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({
                type: 'png',
                data: im.data,
                transformation: { width: Math.round(im.w * scale), height: Math.round(im.h * scale) },
                altText: { name: 'Math formula', description: t.text, title: '' },
              })],
              ...(env.indent ? { indent: { left: env.indent } } : {}),
            }));
            break;
          }
        }
        // Mermaid diagrams were pre-rendered to PNG; emit as a centred image paragraph.
        if (l === 'mermaid') {
          const im = ctx.images.get(`mermaid:${t.text}`);
          if (im) {
            const maxW = (ctx.st.contentWidthMm - (env.indent / 1440) * 25.4) * (96 / 25.4);
            const scale = Math.min(1, maxW / im.w);
            out.push(new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({
                type: 'png',
                data: im.data,
                transformation: { width: Math.round(im.w * scale), height: Math.round(im.h * scale) },
                altText: { name: 'Mermaid diagram', description: 'Mermaid diagram', title: '' },
              })],
              ...(env.indent ? { indent: { left: env.indent } } : {}),
            }));
          } else {
            // Fallback: render as code block if PNG isn't available.
            out.push(new Paragraph({
              style: 'MdCode',
              children: [new TextRun({ text: t.text })],
              ...(env.indent ? { indent: { left: env.indent } } : {}),
            }));
          }
          break;
        }
        const lines = t.text.replace(/\t/g, '    ').split('\n');
        out.push(new Paragraph({
          style: 'MdCode',
          children: lines.map((l, i) => new TextRun({ text: l, break: i > 0 ? 1 : undefined })),
          ...(env.indent ? { indent: { left: env.indent } } : {}),
        }));
        break;
      }
      case 'blockquote':
        out.push(...blocks(t.tokens, ctx, { ...env, quote: env.quote + 1 }));
        break;
      case 'list':
        out.push(...list(t, ctx, env));
        break;
      case 'table':
        out.push(table(t, ctx, env), new Paragraph({ spacing: { after: 0 }, children: [] }));
        break;
      case 'hr':
        out.push(new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'A6A6A6', space: 1 } },
        }));
        break;
      case 'html':
        if (/^\s*<!--[\s\S]*-->\s*$/.test(t.text)) break;
        ctx.warnings.add('Raw HTML was kept as plain text.');
        out.push(para([run(t.text.trim(), {}, ctx.st)], env));
        break;
      default:
        ctx.warnings.add(`Unsupported block "${t.type}" kept as plain text.`);
        out.push(para([run(t.raw || '', {}, ctx.st)], env));
    }
  }
  return out;
}

function list(t, ctx, env) {
  const level = Math.min(env.listLevel + 1, 8);
  let reference = 'md-bullet';
  if (t.ordered) {
    reference = `md-ol-${ctx.numbering.length}`;
    ctx.numbering.push(orderedConfig(reference, Number.isInteger(t.start) ? t.start : 1));
  }
  const inner = { ...env, listLevel: level, indent: LIST_INDENT * (level + 1) };
  const out = [];
  for (const item of t.items) {
    let first = true;
    for (const sub of item.tokens) {
      if (first && (sub.type === 'text' || sub.type === 'paragraph')) {
        const runs = sub.tokens ? inlines(sub.tokens, ctx, inner) : [run(sub.text, {}, ctx.st)];
        if (item.task) runs.unshift(new TextRun({ text: item.checked ? '☒ ' : '☐ ' }));
        out.push(new Paragraph({ numbering: { reference, level }, children: runs }));
        first = false;
      } else if (sub.type === 'list') {
        out.push(...list(sub, ctx, { ...env, listLevel: level }));
      } else if (sub.type !== 'space') {
        out.push(...blocks([sub], ctx, inner));
      }
    }
    if (first) out.push(new Paragraph({ numbering: { reference, level }, children: [] }));
  }
  return out;
}

function tableBorders(st) {
  const line = { style: BorderStyle.SINGLE, size: 4, color: hex(st.borderColor) };
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const all = st.tableBorders === 'all';
  const horiz = st.tableBorders !== 'none';
  return {
    top: horiz ? line : none,
    bottom: horiz ? line : none,
    insideHorizontal: horiz ? line : none,
    left: all ? line : none,
    right: all ? line : none,
    insideVertical: all ? line : none,
  };
}

function table(t, ctx, env) {
  const st = ctx.st;
  const cols = t.header.length;
  const colW = Math.floor((mmTw(st.contentWidthMm) - env.indent) / cols);
  const align = { center: AlignmentType.CENTER, right: AlignmentType.RIGHT };
  const cell = (c, i, header) => new TableCell({
    width: { size: colW, type: WidthType.DXA },
    ...(header ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: hex(st.tableHeaderBg) } } : {}),
    children: [new Paragraph({
      alignment: align[t.align[i]] || AlignmentType.LEFT,
      spacing: { after: 0, line: 240 },
      children: inlines(c.tokens, ctx, env, header ? { bold: true } : {}),
    })],
  });
  return new Table({
    width: { size: colW * cols, type: WidthType.DXA },
    columnWidths: Array(cols).fill(colW),
    borders: tableBorders(st),
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    ...(env.indent ? { indent: { size: env.indent, type: WidthType.DXA } } : {}),
    rows: [
      new TableRow({ tableHeader: true, children: t.header.map((c, i) => cell(c, i, true)) }),
      ...t.rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) })),
    ],
  });
}
