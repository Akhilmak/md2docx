# md2docx

A small browser tool that converts Markdown to a real Word `.docx` file. You can type, paste or upload Markdown, choose a template, check the preview and download the result.

Everything runs in the browser. Documents are never sent to a server. The only network use is loading three libraries from the jsDelivr CDN, plus any remote images the Markdown links to.

## Run

```bash
cd ~/tools/md2docx
python3 -m http.server 8000
```

Then open <http://localhost:8000>. The page needs a server because it uses ES modules and an import map; opening `index.html` directly from disk will not work. The first load needs internet access.

## Features

- **Input:** type in the editor, paste, upload a `.md`, `.markdown` or `.txt` file (up to 5 MB), or drag a file onto the editor. Use **Load sample** and **Clear** to start over. Your text and settings are kept in the browser's local storage.
- **Templates:**
  - **Professional:** Aptos, blue headings, horizontal table rules.
  - **Minimal:** Georgia, black and white, plain grid tables.
  - **Technical:** Arial, ruled H1 and H2, grid tables, boxed monospaced code.
- **Settings you can change:** body font, font size, heading colour, table header background, table borders (all, horizontal or none), page size (A4 or Letter), and margins. **Reset to template defaults** undoes your changes.
- **Preview:**
  - **HTML preview:** a fast, paginated approximation of the page.
  - **Word render:** builds the real `.docx` and renders it with docx-preview, so you can inspect the actual output.
- **Export:** a native `.docx` with:
  - Word's built-in Heading 1–6 styles, so the Word navigation pane and table of contents work.
  - Real Word numbering for bullet, numbered and nested lists.
  - Real Word tables with a repeating header row and column alignment.
  - Clickable hyperlinks.
  - "Code Block" and "Block Quote" paragraph styles.
  - Inline code, strikethrough, horizontal rules and task-list checkboxes.
  - The page size and margins you selected.
  - Embedded images. SVG and WebP images are converted to PNG.

## Layout

| File | Role |
|---|---|
| `index.html` | Page and import map (pinned library versions) |
| `css/app.css` | App layout and the simulated Word page |
| `js/templates.js` | Template definitions and the resolved style that the preview and the export share |
| `js/markdown.js` | Markdown parsing with marked, safe HTML for the preview |
| `js/preview.js` | Pagination for the HTML preview |
| `js/docx-export.js` | Markdown tokens to Word objects, built with docx.js |
| `js/app.js` | UI wiring |
| `js/sample.js` | The sample document |

Libraries: [marked](https://marked.js.org) 15.0.12, [docx](https://docx.js.org) 9.11.0, and [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) 0.4.1. All are loaded from jsDelivr.

## Limitations

- The HTML preview is approximate. Word decides the final line and page breaks. Tall tables and code blocks are not split across preview pages.
- Raw HTML in the Markdown is not interpreted. It appears as plain text, and the Format panel shows a warning. `<br>` is the one exception: it becomes a line break.
- A remote image is embedded only if its server allows cross-origin requests (CORS). Otherwise a placeholder such as `[image: alt]` appears and a warning is shown.
- Internal anchor links (`#section`) and relative links become plain text in Word.
- Footnotes, math and Mermaid diagrams are not supported; they appear as their Markdown text.
- If the Aptos font is not installed, the preview substitutes a similar font. Word on a machine without Aptos does the same.
