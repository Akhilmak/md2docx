/**
 * latex-render.js
 * LaTeX math rendering module using MathJax tex-svg.
 *
 * Exported API
 * ─────────────
 * ensureMathJax()                   → Promise<void>
 * renderTexToSvg(tex, isDisplay)    → Promise<{svg: string, w: number, h: number}>
 * texToPngBuffer(tex, isDisplay)    → Promise<{data: ArrayBuffer, w: number, h: number}>
 */

let _mathjaxPromise = null;

export function ensureMathJax() {
  if (window.MathJax && window.MathJax.tex2svg) {
    return Promise.resolve();
  }
  if (_mathjaxPromise) return _mathjaxPromise;

  _mathjaxPromise = new Promise((resolve, reject) => {
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true,
      },
      svg: {
        fontCache: 'local', // inlines glyph defs in each SVG
      },
      startup: {
        typeset: false,
        ready: () => {
          window.MathJax.defaultReady();
          resolve();
        },
      },
    };

    const script = document.createElement('script');
    script.id = 'MathJax-script';
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load MathJax from CDN'));
    document.head.appendChild(script);
  });

  return _mathjaxPromise;
}

const _texCache = new Map();

/**
 * Normalise SVG dimensions from MathJax SVG output.
 * MathJax outputs width/height in 'ex' (e.g. "5.43ex").
 * 1ex is approx 8.5px at base font size, or we use the viewBox aspect ratio.
 */
function parseMathJaxDims(svgEl, isDisplay) {
  let wEx = parseFloat(svgEl.getAttribute('width')) || 0;
  let hEx = parseFloat(svgEl.getAttribute('height')) || 0;

  const vb = svgEl.getAttribute('viewBox');
  let vbW = 0, vbH = 0;
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/);
    vbW = parseFloat(parts[2]) || 0;
    vbH = parseFloat(parts[3]) || 0;
  }

  // 1ex ≈ 8.5px for inline math, 10px for display math
  const pxPerEx = isDisplay ? 10 : 8.5;
  let w = Math.round(wEx * pxPerEx);
  let h = Math.round(hEx * pxPerEx);

  if (!w || !h) {
    if (vbW && vbH) {
      h = isDisplay ? 36 : 20;
      w = Math.round((vbW / vbH) * h);
    } else {
      w = 120;
      h = 30;
    }
  }

  // Ensure minimum dimensions
  w = Math.max(12, w);
  h = Math.max(12, h);

  svgEl.setAttribute('width', String(w));
  svgEl.setAttribute('height', String(h));

  return { w, h };
}

/**
 * Render a TeX math string to an SVG string.
 * @param {string} tex
 * @param {boolean} isDisplay
 * @returns {Promise<{svg: string, w: number, h: number}>}
 */
export async function renderTexToSvg(tex, isDisplay = false) {
  const cacheKey = `${isDisplay ? 'D' : 'I'}::${tex.trim()}`;
  if (_texCache.has(cacheKey)) return _texCache.get(cacheKey);

  await ensureMathJax();

  const node = window.MathJax.tex2svg(tex.trim(), { display: isDisplay });
  const svgEl = node.querySelector('svg');
  if (!svgEl) {
    throw new Error('MathJax failed to produce SVG output');
  }

  // Style attributes for inline / display embedding
  svgEl.style.background = 'transparent';
  svgEl.style.verticalAlign = isDisplay ? 'middle' : '-0.25em';
  svgEl.style.overflow = 'visible';

  const { w, h } = parseMathJaxDims(svgEl, isDisplay);
  const svg = new XMLSerializer().serializeToString(svgEl);

  const res = { svg, w, h };
  _texCache.set(cacheKey, res);
  return res;
}

/**
 * Convert TeX to transparent PNG data URL.
 * @param {string} tex
 * @param {boolean} isDisplay
 * @returns {Promise<string>}
 */
export async function texToPngDataUrl(tex, isDisplay = false) {
  const { svg, w, h } = await renderTexToSvg(tex, isDisplay);

  return new Promise((resolve, reject) => {
    const scale = 2.5; // High resolution for Word
    const fw = Math.round(w * scale);
    const fh = Math.round(h * scale);

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = fw;
      canvas.height = fh;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, fw, fh);
      ctx.drawImage(img, 0, 0, fw, fh);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to rasterize LaTeX SVG'));
    img.src = dataUrl;
  });
}

/**
 * Render a TeX math string to a PNG ArrayBuffer for docx ImageRun.
 * @param {string} tex
 * @param {boolean} isDisplay
 * @returns {Promise<{data: ArrayBuffer, w: number, h: number}>}
 */
export async function texToPngBuffer(tex, isDisplay = false) {
  const { w, h } = await renderTexToSvg(tex, isDisplay);
  const dataUrl = await texToPngDataUrl(tex, isDisplay);
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { data: bytes.buffer, w, h };
}
