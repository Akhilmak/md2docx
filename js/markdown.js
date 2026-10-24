// Markdown parsing and the HTML used by the preview.
import { Marked } from 'marked';
import { getCachedSvg } from './mermaid-render.js';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Allows web, mail, anchor and relative links plus data: images; blocks javascript: and similar.
export function safeUrl(href) {
  const h = String(href || '').trim();
  if (!h) return null;
  if (/^data:image\//i.test(h)) return h;
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return null;
  return h;
}

export const isAbsoluteLink = (h) => /^(https?:|mailto:|tel:)/i.test(h || '');

let _activeMermaidCfg = null;
export function setMermaidConfig(cfg) {
  _activeMermaidCfg = cfg;
}

// LaTeX math block extension: $$...$$
const mathBlockExtension = {
  name: 'mathBlock',
  level: 'block',
  start(src) {
    const idx1 = src.indexOf('$$');
    const idx2 = src.indexOf('\\[');
    if (idx1 === -1) return idx2;
    if (idx2 === -1) return idx1;
    return Math.min(idx1, idx2);
  },
  tokenizer(src) {
    const match = src.match(/^\$\$([\s\S]+?)\$\$/) || src.match(/^\\\[([\s\S]+?)\\\]/);
    if (match) {
      return {
        type: 'mathBlock',
        raw: match[0],
        text: match[1].trim(),
      };
    }
  },
  renderer(token) {
    const encoded = btoa(unescape(encodeURIComponent(token.text)));
    return `<div class="math-block" data-tex="${encoded}">\\[ ${escapeHtml(token.text)} \\]</div>`;
  },
};

// LaTeX inline math extension: $...$ or \(...\)
const mathInlineExtension = {
  name: 'mathInline',
  level: 'inline',
  start(src) {
    const idx1 = src.indexOf('$');
    const idx2 = src.indexOf('\\(');
    if (idx1 === -1) return idx2;
    if (idx2 === -1) return idx1;
    return Math.min(idx1, idx2);
  },
  tokenizer(src) {
    // $...$ with negative lookahead/lookbehind to avoid currency symbols
    const match = src.match(/^\$(?!\s)([^$\n]+?)(?<!\s)\$(?!\d)/) || src.match(/^\\\(([\s\S]+?)\\\)/);
    if (match) {
      return {
        type: 'mathInline',
        raw: match[0],
        text: match[1].trim(),
      };
    }
  },
  renderer(token) {
    const encoded = btoa(unescape(encodeURIComponent(token.text)));
    return `<span class="math-inline" data-tex="${encoded}">\\( ${escapeHtml(token.text)} \\)</span>`;
  },
};

const marked = new Marked({
  gfm: true,
  extensions: [mathBlockExtension, mathInlineExtension],
  renderer: {
    // Raw HTML is shown as text, never executed.
    html({ text, block }) {
      if (/^<br\s*\/?>$/i.test(text.trim())) return '<br>';
      return block ? `<p class="raw-html">${escapeHtml(text)}</p>` : `<span class="raw-html">${escapeHtml(text)}</span>`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const url = safeUrl(href);
      if (!url) return text;
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(url)}"${t} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    image({ href, title, text }) {
      const url = safeUrl(href);
      if (!url) return `<span class="missing-img">[image: ${escapeHtml(text)}]</span>`;
      const t = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(text)}"${t}>`;
    },
    // Fenced code blocks for mermaid and math/latex.
    code({ lang, text }) {
      const l = (lang || '').trim().toLowerCase();
      if (l === 'mermaid') {
        const cached = getCachedSvg(text, _activeMermaidCfg);
        if (cached) {
          const maxW = _activeMermaidCfg?.maxWidth || 700;
          const svgPart = cached.slice(cached.indexOf('<svg') + 4);
          return `<div class="mermaid-wrapper"><svg class="mermaid-svg" style="max-width:${maxW}px;width:100%;height:auto;display:block;margin:8px auto;" ${svgPart}</div>`;
        }
        const encoded = btoa(unescape(encodeURIComponent(text)));
        return `<div class="mermaid-block" data-source="${encoded}"><em>Rendering diagram…</em></div>`;
      }
      if (['math', 'latex', 'tex'].includes(l)) {
        const encoded = btoa(unescape(encodeURIComponent(text)));
        return `<div class="math-block" data-tex="${encoded}">\\[ ${escapeHtml(text)} \\]</div>`;
      }
      // Default code block.
      return `<pre><code class="language-${escapeHtml(lang || '')}">${escapeHtml(text)}</code></pre>`;
    },
  },
});

export const lex = (md) => marked.lexer(md);
export const toHtml = (md) => marked.parser(marked.lexer(md));
