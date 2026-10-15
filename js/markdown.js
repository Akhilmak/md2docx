// Markdown parsing and the HTML used by the preview.
import { Marked } from 'marked';

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

const marked = new Marked({
  gfm: true,
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
  },
});

export const lex = (md) => marked.lexer(md);
export const toHtml = (md) => marked.parser(marked.lexer(md));
