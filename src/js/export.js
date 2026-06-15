const ExportManager = {
  init() {
    document.getElementById('btn-export').addEventListener('click', () => this.showExportDialog());
  },

  showExportDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>导出文档</h2>
        <p class="modal-description">选择导出格式。HTML 和 PDF 都会使用当前安全预览结果。</p>
        <div class="export-options">
          <label class="export-option selected">
            <input type="radio" name="export-format" value="html" checked>
            <strong>HTML</strong>
            <span>导出为可在浏览器中打开的静态网页</span>
          </label>
          <label class="export-option">
            <input type="radio" name="export-format" value="pdf">
            <strong>PDF</strong>
            <span>导出仅包含文档内容的打印版 PDF</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" id="export-confirm">导出</button>
          <button id="export-cancel">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll('input[name="export-format"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        overlay.querySelectorAll('.export-option').forEach((label) => {
          label.classList.toggle('selected', label.contains(radio) && radio.checked);
        });
      });
    });

    overlay.querySelector('#export-confirm').addEventListener('click', async () => {
      const selected = overlay.querySelector('input[name="export-format"]:checked');
      if (!selected) return;
      overlay.remove();

      if (selected.value === 'html') await this.exportHTML();
      else await this.exportPDF();
    });

    overlay.querySelector('#export-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) overlay.remove();
    });
  },

  arrayBufferToDataUrl(buffer, mimeType) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return `data:${mimeType};base64,${btoa(binary)}`;
  },

  async inlineStyleAssets(cssText, stylesheetUrl) {
    const matches = Array.from(cssText.matchAll(/url\((['"]?)([^'")]+)\1\)/g));
    let result = cssText;

    for (const match of matches) {
      const assetPath = match[2];
      if (/^(data:|https?:)/i.test(assetPath)) continue;

      try {
        const assetUrl = new URL(assetPath, stylesheetUrl).href;
        const response = await fetch(assetUrl);
        if (!response.ok) continue;
        const buffer = await response.arrayBuffer();
        const extension = assetPath.split('.').pop()?.toLowerCase();
        const mimeType = extension === 'woff2' ? 'font/woff2' :
          extension === 'woff' ? 'font/woff' :
          extension === 'ttf' ? 'font/ttf' : 'application/octet-stream';
        result = result.replace(match[0], `url("${this.arrayBufferToDataUrl(buffer, mimeType)}")`);
      } catch {
        // Keep the original URL if an optional asset cannot be embedded.
      }
    }
    return result;
  },

  async collectLibraryStyles() {
    const css = [];
    for (const sheet of document.styleSheets) {
      try {
        const href = sheet.href || '';
        if (!href.includes('/vendor/')) continue;
        const sheetCss = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
        css.push(await this.inlineStyleAssets(sheetCss, href));
      } catch {
        // Local bundled styles should be readable; skip a sheet if Chromium rejects it.
      }
    }
    return css.join('\n');
  },

  escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value);
    return element.innerHTML;
  },

  async buildExportDocument() {
    const content = Editor.currentContent || '';
    if (!content.trim()) return null;

    const rendered = await MarkdownRenderer.renderForExport(content);
    const title = this.escapeHtml(Editor.currentFileName || '导出文档');
    const libraryStyles = await this.collectLibraryStyles();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: file: https:; font-src data:;">
  <title>${title}</title>
  <style>
    ${libraryStyles}
    @page { size: auto; margin: 18mm; }
    * { box-sizing: border-box; }
    body { max-width: 860px; margin: 0 auto; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.7; color: #24292f; overflow-wrap: anywhere; }
    h1, h2 { border-bottom: 1px solid #d8dee4; padding-bottom: 0.3em; }
    h1, h2, h3, h4 { break-after: avoid; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; break-inside: avoid; }
    code { background: #eff1f3; padding: 2px 6px; border-radius: 3px; font-family: "Cascadia Code", Consolas, monospace; font-size: 0.9em; }
    pre code { background: none; padding: 0; }
    img, svg { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; break-inside: avoid; }
    th, td { border: 1px solid #d0d7de; padding: 6px 12px; text-align: left; }
    blockquote { border-left: 3px solid #0969da; padding-left: 12px; color: #57606a; margin-left: 0; }
    a { color: #0969da; }
    .task-list-item { list-style: none; }
    .mermaid { text-align: center; break-inside: avoid; }
    .powered-by { margin-top: 40px; padding-top: 16px; border-top: 1px solid #d8dee4; text-align: center; font-size: 12px; color: #6e7781; }
    @media print {
      body { max-width: none; padding: 0; }
      a { color: inherit; text-decoration: none; }
      .powered-by { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main>${rendered}</main>
  <footer class="powered-by">使用极简 Markdown 编辑器制作</footer>
</body>
</html>`;
  },

  async exportHTML() {
    const html = await this.buildExportDocument();
    if (!html) {
      alert('没有内容可导出');
      return;
    }

    const result = await window.electronAPI.exportHTML(html);
    if (result && result.success) Editor.showStatus('已导出 HTML');
    else if (result && result.error) Editor.showStatus('HTML 导出失败');
  },

  async exportPDF() {
    const html = await this.buildExportDocument();
    if (!html) {
      alert('没有内容可导出');
      return;
    }

    const result = await window.electronAPI.exportPDF(html);
    if (result && result.success) Editor.showStatus('已导出 PDF');
    else if (result && result.error) Editor.showStatus('PDF 导出失败');
  }
};
