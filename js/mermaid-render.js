/**
 * mermaid-render.js
 * Wrapper around the Mermaid diagramming library.
 *
 * Exported API
 * ─────────────
 * buildThemeVars(cfg)             → object                  – themeVariables for mermaid.initialize
 * buildThemeCSS(cfg)              → string                  – custom CSS injected into SVG
 * renderMermaidSvg(source, cfg?)  → Promise<string>         – raw SVG markup
 * svgToInlineDataUrl(svg)         → string                  – data:image/svg+xml (for <img>)
 * svgToPngDataUrl(svg, cfg?)      → Promise<string>         – transparent PNG data URL (for docx)
 * mermaidToPngBuffer(source,cfg?) → Promise<{data,w,h}>    – PNG ArrayBuffer for docx ImageRun
 */

import mermaid from 'mermaid';

/* ─── theme variable & css builders ───────────────────────────────────── */

/**
 * Build themeVariables object from user settings.
 */
export function buildThemeVars(cfg = {}) {
  const nodeFill      = cfg.nodeFill        || '#E8F4FD';
  const nodeBorder    = cfg.nodeBorder      || '#5A9FD4';
  const nodeText      = cfg.nodeText        || '#1A1A1A';
  const edgeColor     = cfg.edgeColor       || '#555555';
  const edgeText      = cfg.edgeText        || '#333333';
  const secFill       = cfg.secondaryFill   || '#FFF5CC';
  const fontPx        = cfg.fontSize        ? `${cfg.fontSize}px` : '13px';
  const fontFam       = cfg.fontFamily      || 'Arial, sans-serif';

  return {
    /* ---- flowchart / graph ---- */
    primaryColor:         nodeFill,
    primaryBorderColor:   nodeBorder,
    primaryTextColor:     nodeText,
    lineColor:            edgeColor,
    edgeLabelBackground:  '#FFFFFF',
    tertiaryColor:        secFill,
    tertiaryBorderColor:  nodeBorder,
    tertiaryTextColor:    nodeText,
    background:           'transparent',
    mainBkg:              nodeFill,
    nodeBorder:           nodeBorder,
    nodeTextColor:        nodeText,
    textColor:            nodeText,
    labelColor:           nodeText,
    clusterBkg:           '#F9FBFD',
    clusterBorder:        nodeBorder,

    /* ---- sequence diagram ---- */
    actorBkg:             nodeFill,
    actorBorder:          nodeBorder,
    actorTextColor:       nodeText,
    actorLineColor:       edgeColor,
    signalColor:          edgeColor,
    signalTextColor:      edgeText,
    labelBoxBkgColor:     nodeFill,
    labelBoxBorderColor:  nodeBorder,
    labelTextColor:       nodeText,
    loopTextColor:        nodeText,
    noteBkgColor:         secFill,
    noteTextColor:        nodeText,
    noteBorderColor:      nodeBorder,
    activationBkgColor:   secFill,
    activationBorderColor: nodeBorder,
    sequenceNumberColor:  '#FFFFFF',

    /* ---- typography ---- */
    fontSize:             fontPx,
    fontFamily:           fontFam,
  };
}

/**
 * Generate CSS rules that enforce node borders, edge widths, and text styling
 * on both standard SVG nodes and sequence actors.
 */
export function buildThemeCSS(cfg = {}) {
  const nodeFill        = cfg.nodeFill        || '#E8F4FD';
  const nodeBorder      = cfg.nodeBorder      || '#5A9FD4';
  const nodeBorderWidth = cfg.nodeBorderWidth || 1.5;
  const nodeText        = cfg.nodeText        || '#1A1A1A';
  const edgeColor       = cfg.edgeColor       || '#555555';
  const edgeWidth       = cfg.edgeWidth       || 1.5;
  const edgeText        = cfg.edgeText        || '#333333';
  const secFill         = cfg.secondaryFill   || '#FFF5CC';
  const fontPx          = cfg.fontSize        ? `${cfg.fontSize}px` : '13px';
  const fontFam         = cfg.fontFamily      || 'Arial, sans-serif';

  return `
    /* === General / Typography === */
    svg { font-family: ${fontFam} !important; }
    text { font-family: ${fontFam} !important; }

    /* === Nodes / Vertices === */
    .node rect, .node circle, .node ellipse, .node polygon, .node path.outer {
      fill: ${nodeFill} !important;
      stroke: ${nodeBorder} !important;
      stroke-width: ${nodeBorderWidth}px !important;
    }
    .node .label, .node text, .node tspan {
      fill: ${nodeText} !important;
      color: ${nodeText} !important;
      font-size: ${fontPx} !important;
      font-weight: 500;
    }

    /* === Edges / Links / Arrows === */
    .edgePaths path, .flowchart-link, .edgePath .path {
      stroke: ${edgeColor} !important;
      stroke-width: ${edgeWidth}px !important;
      fill: none !important;
    }
    .marker, .arrowMarkerPath, marker path {
      fill: ${edgeColor} !important;
      stroke: ${edgeColor} !important;
    }
    .edgeLabel, .edgeLabel span, .edgeLabel text {
      fill: ${edgeText} !important;
      color: ${edgeText} !important;
      font-size: ${Math.max(10, (cfg.fontSize || 13) - 2)}px !important;
    }
    .edgeLabel rect {
      fill: #FFFFFF !important;
      opacity: 0.9 !important;
    }

    /* === Sequence Diagram === */
    rect.actor, .actor > rect, rect[class*="actor"] {
      fill: ${nodeFill} !important;
      stroke: ${nodeBorder} !important;
      stroke-width: ${nodeBorderWidth}px !important;
    }
    text.actor, text.actor > tspan {
      fill: ${nodeText} !important;
      font-size: ${fontPx} !important;
      stroke: none !important;
      font-weight: 500;
    }
    .actor-line, line[class*="actor-line"] {
      stroke: ${edgeColor} !important;
      stroke-width: ${edgeWidth}px !important;
    }
    .messageLine0, .messageLine1, line[class*="messageLine"] {
      stroke: ${edgeColor} !important;
      stroke-width: ${edgeWidth}px !important;
    }
    .messageText, text[class*="messageText"] {
      fill: ${edgeText} !important;
      font-size: ${fontPx} !important;
      stroke: none !important;
    }
    #arrowhead path, .sequence-arrowhead, marker[id*="arrowhead"] path {
      fill: ${edgeColor} !important;
      stroke: ${edgeColor} !important;
    }
    .note, rect[class*="note"] {
      fill: ${secFill} !important;
      stroke: ${nodeBorder} !important;
      stroke-width: ${nodeBorderWidth}px !important;
    }
    .noteText, text[class*="noteText"], .noteText > tspan {
      fill: ${nodeText} !important;
      stroke: none !important;
      font-size: ${fontPx} !important;
    }
    .loopLine, line[class*="loopLine"], path[class*="loopLine"] {
      stroke: ${edgeColor} !important;
      stroke-width: ${edgeWidth}px !important;
    }
    .loopText, text[class*="loopText"] {
      fill: ${nodeText} !important;
    }
    .labelBox, rect[class*="labelBox"] {
      fill: ${nodeFill} !important;
      stroke: ${nodeBorder} !important;
      stroke-width: ${nodeBorderWidth}px !important;
    }
  `;
}

/* ─── initialisation ─────────────────────────────────────────────────── */

let _lastCfgKey = null;
let _uidCounter = 0;

function applyConfig(cfg = {}) {
  const key = JSON.stringify(cfg);
  if (key === _lastCfgKey) return;
  mermaid.initialize({
    startOnLoad:   false,
    theme:         'base',
    // Setting htmlLabels: false at the root AND in flowchart ensures Mermaid
    // produces native SVG <text> instead of <foreignObject>. This fixes
    // diagrams when converted to canvas / PNG for DOCX export.
    htmlLabels:    false,
    flowchart:     { htmlLabels: false, useMaxWidth: true, curve: 'linear' },
    sequence:      { useMaxWidth: true, mirrorActors: cfg.mirrorActors !== false, messageAlign: 'center', showSequenceNumbers: true },
    er:            { useMaxWidth: true },
    gantt:         { useMaxWidth: true },
    securityLevel: 'loose',
    themeVariables: buildThemeVars(cfg),
    themeCSS:       buildThemeCSS(cfg),
  });
  _lastCfgKey = key;
}

/* ─── SVG rendering ──────────────────────────────────────────────────── */

const _svgCache = new Map();

export function getCachedSvg(source, cfg = {}) {
  const key = `${source}::${JSON.stringify(cfg)}`;
  return _svgCache.get(key) || null;
}

/**
 * Render mermaid source to raw SVG markup with caching.
 * @param {string} source
 * @param {object} [cfg]  user style configuration
 * @returns {Promise<string>}
 */
export async function renderMermaidSvg(source, cfg = {}) {
  const key = `${source}::${JSON.stringify(cfg)}`;
  if (_svgCache.has(key)) return _svgCache.get(key);

  applyConfig(cfg);
  const id = `mm-${Date.now()}-${++_uidCounter}`;
  const { svg } = await mermaid.render(id, source);

  // Clean up any stray DOM elements mermaid may have appended to <body>.
  document.getElementById(id)?.remove();
  document.getElementById(`d${id}`)?.remove();
  _svgCache.set(key, svg);
  return svg;
}

/**
 * Data URL for preview <img> tags.
 */
export function svgToInlineDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ─── SVG dimensions & safety parsing ───────────────────────────────── */

function parseSvgDims(svg) {
  const doc   = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const svgEl = doc.documentElement;
  let w = parseFloat(svgEl.getAttribute('width'));
  let h = parseFloat(svgEl.getAttribute('height'));
  if (!w || !h) {
    const vb = svgEl.getAttribute('viewBox');
    if (vb) {
      const p = vb.trim().split(/[\s,]+/);
      w = parseFloat(p[2]) || 800;
      h = parseFloat(p[3]) || 600;
    } else { w = 800; h = 600; }
    svgEl.setAttribute('width', String(w));
    svgEl.setAttribute('height', String(h));
  }
  return { svgEl, w, h };
}

/**
 * Safety converter: If an SVG still contains any <foreignObject> elements,
 * convert each into an equivalent SVG <text> element with proper centering
 * so canvas rasterization will not lose any text labels.
 */
function convertForeignObjectsToSvgText(svgEl, textColor = '#1A1A1A', fontSize = 13) {
  svgEl.querySelectorAll('foreignObject').forEach((fo) => {
    const textContent = fo.textContent?.trim();
    if (textContent) {
      const x = parseFloat(fo.getAttribute('x')) || 0;
      const y = parseFloat(fo.getAttribute('y')) || 0;
      const w = parseFloat(fo.getAttribute('width')) || 0;
      const h = parseFloat(fo.getAttribute('height')) || 0;

      const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      textEl.setAttribute('x', String(x + w / 2));
      textEl.setAttribute('y', String(y + h / 2));
      textEl.setAttribute('text-anchor', 'middle');
      textEl.setAttribute('dominant-baseline', 'central');
      textEl.setAttribute('fill', textColor);
      textEl.setAttribute('font-size', `${fontSize}px`);
      textEl.setAttribute('font-family', 'sans-serif');
      textEl.textContent = textContent;
      fo.parentNode?.insertBefore(textEl, fo);
    }
    fo.remove();
  });
}

/* ─── SVG → PNG (for Word DOCX export) ─────────────────────────────────── */

/**
 * Convert SVG string to a high-resolution transparent PNG data URL.
 * Safely converts any residual foreignObjects and avoids canvas tainting.
 * @param {string} svg
 * @param {object} [cfg]
 * @returns {Promise<string>}
 */
export function svgToPngDataUrl(svg, cfg = {}) {
  return new Promise((resolve, reject) => {
    const { svgEl, w, h } = parseSvgDims(svg);

    // Keep background transparent.
    svgEl.style.background = 'transparent';

    // Fallback convert any residual foreignObjects to native SVG text.
    convertForeignObjectsToSvgText(svgEl, cfg.nodeText || '#1A1A1A', cfg.fontSize || 13);

    // Remove any external image elements that would taint the canvas.
    svgEl.querySelectorAll('image').forEach((el) => {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
      if (/^https?:\/\//i.test(href)) el.remove();
    });

    // 2× scaling produces crisp output in Word.
    const scale = 2;
    const fw = Math.round(w * scale);
    const fh = Math.round(h * scale);

    const serialised = new XMLSerializer().serializeToString(svgEl);
    const dataUrl    = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialised)}`;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = fw;
      canvas.height = fh;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, fw, fh);
      ctx.drawImage(img, 0, 0, fw, fh);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(new Error(`Canvas export failed: ${e.message}`));
      }
    };
    img.onerror = () => reject(new Error('SVG rasterization failed'));
    img.src = dataUrl;
  });
}

/* ─── SVG → ArrayBuffer (for docx ImageRun) ────────────────────────── */

/**
 * Render mermaid source and return transparent PNG bytes for docx export.
 * @param {string} source
 * @param {object} [cfg]
 * @returns {Promise<{data: ArrayBuffer, w: number, h: number}>}
 */
export async function mermaidToPngBuffer(source, cfg = {}) {
  const svg            = await renderMermaidSvg(source, cfg);
  const { w, h }       = parseSvgDims(svg);
  const dataUrl        = await svgToPngDataUrl(svg, cfg);
  const base64         = dataUrl.split(',')[1];
  const binary         = atob(base64);
  const bytes          = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { data: bytes.buffer, w: Math.round(w), h: Math.round(h) };
}
