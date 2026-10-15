// UI wiring: input, options, preview tabs, download.
import { TEMPLATES, FONTS, USER_KEYS, defaultSettings, resolveStyle } from './templates.js';
import { SAMPLE } from './sample.js';
import { applyStyleVars, renderPaged } from './preview.js';

const $ = (id) => document.getElementById(id);
const el = {
  md: $('md'), upload: $('upload'), paste: $('paste'), sample: $('sample'), clear: $('clear'),
  options: $('options'), reset: $('reset-format'), warnings: $('warnings'),
  filename: $('filename'), download: $('download'), status: $('status'),
  tabHtml: $('tab-html'), tabWord: $('tab-word'), note: $('preview-note'), pageInfo: $('page-info'),
  scroll: $('preview-scroll'), preview: $('preview'), word: $('word-view'),
};

const MAX_UPLOAD = 5 * 1024 * 1024;
const LARGE_INPUT = 500 * 1024;
const PX_PER_MM = 96 / 25.4;

function setStatus(msg, kind = '') {
  el.status.textContent = msg;
  el.status.className = `status ${kind}`;
}

let toHtml, buildDocx;
try {
  ({ toHtml } = await import('./markdown.js'));
  ({ buildDocx } = await import('./docx-export.js'));
} catch (e) {
  console.error(e);
  setStatus('Could not load the converter libraries from the CDN. Check the internet connection and reload.', 'error');
  throw e;
}

// ---------- persisted state (per browser, best effort) ----------
const store = {
  get(k) { try { return localStorage.getItem(`md2docx.${k}`); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`md2docx.${k}`, v); } catch { /* storage unavailable */ } },
};

let settings = defaultSettings();
try { settings = { ...settings, ...JSON.parse(store.get('settings') || '{}') }; } catch { /* keep defaults */ }

// ---------- options form ----------
const form = el.options.elements;
form.bodyFont.append(...FONTS.map((f) => new Option(f, f)));

function writeForm() {
  for (const k of ['template', 'pageSize', ...USER_KEYS]) form[k].value = settings[k];
}
function readForm() {
  for (const k of ['template', 'pageSize', ...USER_KEYS]) settings[k] = form[k].value;
  store.set('settings', JSON.stringify(settings));
}

el.options.addEventListener('input', (e) => {
  if (e.target.name === 'template') {
    const pageSize = form.pageSize.value;
    settings = { ...defaultSettings(e.target.value), pageSize };
    writeForm();
  }
  readForm();
  schedule();
});
el.options.addEventListener('submit', (e) => e.preventDefault());
el.reset.addEventListener('click', () => {
  settings = { ...defaultSettings(settings.template), pageSize: settings.pageSize };
  writeForm();
  readForm();
  schedule();
});

// ---------- input ----------
function setMarkdown(text, name) {
  el.md.value = text;
  if (name) el.filename.value = sanitizeName(name.replace(/\.(md|markdown|txt)$/i, ''));
  schedule(0);
}

function readFile(file) {
  if (!file) return;
  if (!/\.(md|markdown|txt)$/i.test(file.name)) {
    setStatus(`"${file.name}" is not a .md, .markdown or .txt file.`, 'error');
    return;
  }
  if (file.size > MAX_UPLOAD) {
    setStatus(`"${file.name}" is larger than 5 MB.`, 'error');
    return;
  }
  file.text().then(
    (text) => { setMarkdown(text, file.name); setStatus(`Loaded ${file.name}.`, 'ok'); },
    () => setStatus(`Could not read "${file.name}".`, 'error'),
  );
}

el.upload.addEventListener('change', () => { readFile(el.upload.files[0]); el.upload.value = ''; });
el.md.addEventListener('dragover', (e) => { e.preventDefault(); el.md.classList.add('drag'); });
el.md.addEventListener('dragleave', () => el.md.classList.remove('drag'));
el.md.addEventListener('drop', (e) => {
  el.md.classList.remove('drag');
  if (e.dataTransfer.files.length) { e.preventDefault(); readFile(e.dataTransfer.files[0]); }
});
el.md.addEventListener('input', () => schedule());
el.sample.addEventListener('click', () => setMarkdown(SAMPLE, 'sample'));
el.clear.addEventListener('click', () => { setMarkdown(''); el.md.focus(); });
el.paste.addEventListener('click', async () => {
  try {
    setMarkdown(await navigator.clipboard.readText());
  } catch {
    setStatus('The browser blocked clipboard access. Click in the editor and press Ctrl+V instead.', 'error');
  }
});

// ---------- preview ----------
let view = 'html';
let timer;
let wordJob = 0;

function schedule(delay) {
  clearTimeout(timer);
  const d = delay ?? (el.md.value.length > LARGE_INPUT ? 800 : 250);
  timer = setTimeout(render, d);
}

function fitZoom(st) {
  const avail = el.scroll.clientWidth - 24;
  const zoom = Math.min(1, avail / (st.page.widthMm * PX_PER_MM));
  el.preview.style.setProperty('--zoom', zoom.toFixed(3));
  el.word.style.zoom = zoom.toFixed(3);
}

let relaidOut = false;
function render() {
  const md = el.md.value;
  store.set('markdown', md);
  const st = resolveStyle(settings);
  fitZoom(st);
  if (view === 'word') { renderWord(st); return; }
  try {
    applyStyleVars(el.preview, st);
    const pages = renderPaged(el.preview, toHtml(md), st);
    el.pageInfo.textContent = `≈ ${pages} page${pages > 1 ? 's' : ''}`;
    if (md.length > LARGE_INPUT) setStatus('Large document: the preview updates more slowly.');
    else if (el.status.classList.contains('error') || /Loading/.test(el.status.textContent)) setStatus('Ready.');
    // Images change block heights once loaded, so paginate again once.
    const pending = [...el.preview.querySelectorAll('img')].filter((i) => !i.complete);
    if (pending.length && !relaidOut) {
      relaidOut = true;
      Promise.allSettled(pending.map((i) => new Promise((ok) => { i.onload = i.onerror = ok; })))
        .then(() => render());
    } else {
      relaidOut = false;
    }
  } catch (e) {
    console.error(e);
    setStatus(`Preview failed: ${e.message}`, 'error');
  }
}

async function renderWord(st) {
  const job = ++wordJob;
  el.pageInfo.textContent = 'Building…';
  try {
    const { blob, warnings } = await buildDocx(el.md.value, st, { title: docTitle() });
    const { renderAsync } = await import('docx-preview');
    if (job !== wordJob) return;
    el.word.replaceChildren();
    await renderAsync(blob, el.word, el.word, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true });
    el.pageInfo.textContent = `${Math.round(blob.size / 1024)} KB .docx`;
    showWarnings(warnings);
  } catch (e) {
    console.error(e);
    if (job === wordJob) {
      el.pageInfo.textContent = '';
      setStatus(`Word render failed: ${e.message}`, 'error');
    }
  }
}

function setView(v) {
  view = v;
  el.tabHtml.setAttribute('aria-selected', String(v === 'html'));
  el.tabWord.setAttribute('aria-selected', String(v === 'word'));
  el.preview.hidden = v !== 'html';
  el.word.hidden = v !== 'word';
  el.note.textContent = v === 'html'
    ? 'Approximate HTML preview. Word decides the final line and page breaks.'
    : 'The generated .docx rendered by docx-preview. Close to Word, but Word itself is the final reference.';
  schedule(0);
}
el.tabHtml.addEventListener('click', () => setView('html'));
el.tabWord.addEventListener('click', () => setView('word'));
window.addEventListener('resize', () => schedule(150));

// ---------- download ----------
function sanitizeName(name) {
  const clean = String(name)
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 100);
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean) || !clean ? 'document' : clean;
}

function docTitle() {
  const m = el.md.value.match(/^#{1,6}\s+(.+?)\s*#*\s*$/m);
  return m ? m[1].replace(/[*_`~[\]]/g, '') : sanitizeName(el.filename.value);
}

function showWarnings(list) {
  el.warnings.replaceChildren(...list.map((w) => Object.assign(document.createElement('li'), { textContent: w })));
}

el.download.addEventListener('click', async () => {
  if (!el.md.value.trim()) {
    setStatus('Nothing to convert. Type, paste or upload some Markdown first.', 'error');
    return;
  }
  const name = `${sanitizeName(el.filename.value)}.docx`;
  el.filename.value = name.slice(0, -5);
  el.download.disabled = true;
  setStatus('Building DOCX…');
  try {
    const { blob, warnings } = await buildDocx(el.md.value, resolveStyle(settings), { title: docTitle() });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showWarnings(warnings);
    setStatus(`Saved ${name} (${Math.round(blob.size / 1024)} KB)${warnings.length ? ' with warnings, see Format panel' : ''}.`, 'ok');
  } catch (e) {
    console.error(e);
    setStatus(`Conversion failed: ${e.message}`, 'error');
  } finally {
    el.download.disabled = false;
  }
});

// ---------- start ----------
if (!TEMPLATES[settings.template]) settings = defaultSettings();
writeForm();
el.md.value = store.get('markdown') ?? SAMPLE;
el.download.disabled = false;
setStatus('Ready.');
render();
