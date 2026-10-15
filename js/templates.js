// Template definitions and the resolved style shared by the preview and the DOCX export.

export const PAGE_SIZES = {
  A4: { label: 'A4', widthMm: 210, heightMm: 297 },
  Letter: { label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
};

export const FONTS = ['Aptos', 'Calibri', 'Arial', 'Cambria', 'Georgia', 'Times New Roman', 'Verdana'];

// CSS fallbacks for the preview, used when the browser lacks the Word font.
const FONT_STACKS = {
  Aptos: 'Aptos, Calibri, "Segoe UI", Arial, sans-serif',
  Calibri: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif',
  Arial: 'Arial, "Liberation Sans", Helvetica, sans-serif',
  Cambria: 'Cambria, Caladea, Georgia, serif',
  Georgia: 'Georgia, "DejaVu Serif", serif',
  'Times New Roman': '"Times New Roman", "Liberation Serif", Times, serif',
  Verdana: 'Verdana, "DejaVu Sans", sans-serif',
};
const CODE_STACK = 'Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace';

export const TEMPLATES = {
  professional: {
    label: 'Professional',
    bodyFont: 'Aptos', fontSize: 11, headingColor: '#1F4E79', tableHeaderBg: '#DEEAF6',
    tableBorders: 'horizontal', marginCm: 2.54,
    borderColor: '#9DC3E6', codeFont: 'Consolas', codeBg: '#F2F2F2', codeBorder: false, headingRule: false,
  },
  minimal: {
    label: 'Minimal',
    bodyFont: 'Georgia', fontSize: 11, headingColor: '#000000', tableHeaderBg: '#FFFFFF',
    tableBorders: 'all', marginCm: 2.54,
    borderColor: '#000000', codeFont: 'Consolas', codeBg: '#FFFFFF', codeBorder: true, headingRule: false,
  },
  technical: {
    label: 'Technical',
    bodyFont: 'Arial', fontSize: 10.5, headingColor: '#222222', tableHeaderBg: '#E7E6E6',
    tableBorders: 'all', marginCm: 2,
    borderColor: '#808080', codeFont: 'Consolas', codeBg: '#F3F3F3', codeBorder: true, headingRule: true,
  },
};

// Settings the user can change; everything else comes from the template.
export const USER_KEYS = ['bodyFont', 'fontSize', 'headingColor', 'tableHeaderBg', 'tableBorders', 'marginCm'];

const HEADING_SCALE = [1.8, 1.45, 1.2, 1.1, 1, 1];

const clamp = (v, lo, hi, dflt) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : dflt);
const color = (v, dflt) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : dflt);

export function defaultSettings(templateId = 'professional') {
  const t = TEMPLATES[templateId] || TEMPLATES.professional;
  const s = { template: TEMPLATES[templateId] ? templateId : 'professional', pageSize: 'A4' };
  for (const k of USER_KEYS) s[k] = t[k];
  return s;
}

export function resolveStyle(settings) {
  const t = TEMPLATES[settings.template] || TEMPLATES.professional;
  const page = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.A4;
  const fontSize = clamp(settings.fontSize, 8, 20, t.fontSize);
  const marginCm = clamp(settings.marginCm, 0.5, 5, t.marginCm);
  const bodyFont = FONTS.includes(settings.bodyFont) ? settings.bodyFont : t.bodyFont;
  return {
    ...t,
    bodyFont,
    bodyFontCss: FONT_STACKS[bodyFont],
    codeFontCss: CODE_STACK,
    fontSize,
    codeSize: Math.max(7, fontSize - 1.5),
    headingSizes: HEADING_SCALE.map((f) => Math.round(fontSize * f * 2) / 2),
    headingColor: color(settings.headingColor, t.headingColor),
    tableHeaderBg: color(settings.tableHeaderBg, t.tableHeaderBg),
    tableBorders: ['all', 'horizontal', 'none'].includes(settings.tableBorders) ? settings.tableBorders : t.tableBorders,
    marginCm,
    page,
    contentWidthMm: page.widthMm - marginCm * 20,
    contentHeightMm: page.heightMm - marginCm * 20,
    paraAfterPt: 8,
    lineSpacing: 1.15,
  };
}
