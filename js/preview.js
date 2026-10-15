// Paginated HTML preview. Approximates Word layout; it does not reproduce Word's line breaking.

const PX_PER_MM = 96 / 25.4;

export function applyStyleVars(el, st) {
  const v = {
    '--page-w': `${st.page.widthMm}mm`,
    '--page-h': `${st.page.heightMm}mm`,
    '--margin': `${st.marginCm}cm`,
    '--content-w': `${st.contentWidthMm}mm`,
    '--font': st.bodyFontCss,
    '--code-font': st.codeFontCss,
    '--size': `${st.fontSize}pt`,
    '--code-size': `${st.codeSize}pt`,
    '--para-after': `${st.paraAfterPt}pt`,
    '--line': String(st.lineSpacing),
    '--heading-color': st.headingColor,
    '--th-bg': st.tableHeaderBg,
    '--border-color': st.borderColor,
    '--code-bg': st.codeBg,
  };
  st.headingSizes.forEach((s, i) => { v[`--h${i + 1}`] = `${s}pt`; });
  for (const [k, val] of Object.entries(v)) el.style.setProperty(k, val);
  el.dataset.borders = st.tableBorders;
  el.classList.toggle('heading-rule', st.headingRule);
  el.classList.toggle('code-border', st.codeBorder);
}

function newPage(container) {
  const page = document.createElement('div');
  page.className = 'page';
  const body = document.createElement('div');
  body.className = 'page-body doc';
  page.append(body);
  container.append(page);
  return body;
}

// Lays top-level blocks onto pages; a block taller than a page gets a page of its own.
export function renderPaged(container, html, st) {
  container.replaceChildren();
  const measure = newPage(container);
  measure.innerHTML = html;
  const blocks = [...measure.children];
  if (!blocks.length) {
    measure.innerHTML = '<p class="empty-note">Nothing to preview. Type or upload Markdown on the left.</p>';
    return 1;
  }
  const heights = blocks.map((b, i) => {
    const next = i + 1 < blocks.length ? blocks[i + 1].offsetTop : measure.scrollHeight;
    return next - b.offsetTop;
  });
  // Measured in layout units, so the preview zoom does not skew the comparison.
  const probe = document.createElement('div');
  probe.style.height = 'calc(var(--page-h) - 2 * var(--margin))';
  measure.append(probe);
  const limit = probe.offsetHeight || st.contentHeightMm * PX_PER_MM;
  container.replaceChildren();
  let body = newPage(container);
  let used = 0;
  let pages = 1;
  blocks.forEach((b, i) => {
    if (used > 0 && used + heights[i] > limit) {
      body = newPage(container);
      used = 0;
      pages++;
    }
    body.append(b);
    used += heights[i];
  });
  return pages;
}
