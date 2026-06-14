const ExportManager = {
  init() {
    document.getElementById('btn-export').addEventListener('click', () => this.showExportDialog());
  },

  showExportDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2>📤 导出文档</h2>
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
          选择导出格式，然后点击「导出」按钮
        </p>
        <div style="margin-bottom:16px;">
          <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:2px solid var(--accent);border-radius:8px;background:var(--active-bg);cursor:pointer;margin-bottom:8px;">
            <input type="radio" name="export-format" value="html" checked style="accent-color:var(--accent);">
            <span style="font-weight:600;">HTML</span>
            <span style="font-size:12px;color:var(--text-secondary);">导出为网页文件，可在浏览器直接打开</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:2px solid var(--border-color);border-radius:8px;cursor:pointer;">
            <input type="radio" name="export-format" value="pdf" style="accent-color:var(--accent);">
            <span style="font-weight:600;">PDF</span>
            <span style="font-size:12px;color:var(--text-secondary);">导出为 PDF 文档，适合打印和分享</span>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" id="export-confirm">导出</button>
          <button id="export-cancel">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const radios = overlay.querySelectorAll('input[name="export-format"]');
    radios.forEach(r => {
      r.addEventListener('change', () => {
        overlay.querySelectorAll('label').forEach(l => {
          l.style.borderColor = 'var(--border-color)';
          l.style.background = 'transparent';
        });
        const label = r.closest('label');
        if (label) {
          label.style.borderColor = 'var(--accent)';
          label.style.background = 'var(--active-bg)';
        }
      });
    });

    document.getElementById('export-confirm').addEventListener('click', () => {
      const selected = overlay.querySelector('input[name="export-format"]:checked');
      if (!selected) return;
      document.body.removeChild(overlay);

      if (selected.value === 'html') {
        this.exportHTML();
      } else {
        this.exportPDF();
      }
    });

    document.getElementById('export-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  },

  async exportHTML() {
    const content = Editor.currentContent || '';
    if (!content) {
      alert('没有内容可导出');
      return;
    }

    const rendered = typeof marked !== 'undefined' ? marked.parse(content) : `<pre>${content}</pre>`;

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${Editor.currentFileName || '导出文档'}</title>
  <style>
    body { max-width: 800px; margin: 0 auto; padding: 40px; font-family: -apple-system, "Segoe UI", sans-serif; line-height: 1.7; color: #333; }
    h1, h2 { border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    pre code { background: none; padding: 0; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 6px 12px; }
    blockquote { border-left: 3px solid #0071e3; padding-left: 12px; color: #666; margin: 0.5em 0; }
    .task-list-item { list-style: none; }
    .powered-by { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999; }
    .powered-by a { color: #0071e3; text-decoration: none; }
  </style>
</head>
<body>${rendered}
  <div class="powered-by">
    使用 <a href="https://github.com/yibanyiban78/markdown-editor" target="_blank">极简Markdown编辑器</a> 制作 · 开源免费
  </div>
</body>
</html>`;

    // 通过 Electron IPC 调用保存对话框，实际写入文件
    const result = await window.electronAPI.exportHTML(html);
    if (result && result.success) {
      document.getElementById('status-text').textContent = '已导出 HTML';
      setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 2000);
    }
  },

  async exportPDF() {
    const result = await window.electronAPI.exportPDF();
    if (result && result.success) {
      document.getElementById('status-text').textContent = '已导出 PDF';
      setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 2000);
    }
  }
};
