/**
 * 跨平台 API 适配层
 * 在 Web/Android 环境中模拟 electronAPI 接口
 * 优先使用 Electron IPC，不存在时回落为 Web API
 */
(function () {
  // 如果已有 Electron API，不做任何事
  if (window.electronAPI && window.electronAPI.openFile) return;

  const WebAPI = {
    /** 打开文件 — 使用 <input type="file"> */
    openFile() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.markdown,.txt';
        input.onchange = async () => {
          const file = input.files[0];
          if (!file) { resolve(null); return; }
          const content = await file.text();
          // 在 Web 环境中，filePath 存为 localStorage key 以便自动保存
          const fileId = 'web_' + file.name + '_' + Date.now();
          localStorage.setItem(fileId + '_name', file.name);
          resolve({
            content,
            filePath: fileId,
            fileName: file.name
          });
        };
        input.click();
      });
    },

    /** 读取文件 — 仅处理通过 openFile 打开的（从 localStorage 取元数据） */
    async readFile(filePath) {
      // Web/Android 不支持按任意路径读取文件
      // 对于拖拽场景，直接从 File 对象读取（在 app.js 中单独处理）
      return null;
    },

    /** 保存文件（显示保存对话框） — 以下载方式保存 */
    async saveFile({ content, filePath }) {
      const fileName = filePath && filePath.startsWith('web_')
        ? (localStorage.getItem(filePath + '_name') || 'document.md')
        : (filePath || 'document.md');
      this._downloadBlob(content, fileName, 'text/markdown');
      return { success: true, filePath: fileName, fileName };
    },

    /** 直接保存（自动保存） — 写入 localStorage */
    async saveDirect({ content, filePath }) {
      try {
        localStorage.setItem('autosave_' + filePath, content);
        return { success: true };
      } catch {
        return { success: false };
      }
    },

    /** 导出 HTML */
    async exportHTML(htmlContent) {
      this._downloadBlob(htmlContent, (Editor.currentFileName || '文档') + '.html', 'text/html');
      return { success: true };
    },

    /** 导出 PDF — 使用 window.print() */
    async exportPDF() {
      // 构造一个只含预览内容的打印页面
      const printWin = window.open('', '_blank');
      if (!printWin) { alert('请允许弹出窗口以打印 PDF'); return { success: false }; }
      const content = Editor.currentContent || '';
      const rendered = typeof marked !== 'undefined'
        ? marked.parse(content)
        : `<pre>${content}</pre>`;
      printWin.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${Editor.currentFileName || '文档'}</title>
<style>
  body { max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif; line-height: 1.7; }
  pre { background:#f5f5f5; padding:12px; border-radius:4px; overflow-x:auto; }
  code { background:#f0f0f0; padding:2px 5px; border-radius:3px; }
  img { max-width:100%; }
  table { border-collapse:collapse; width:100%; }
  th,td { border:1px solid #ddd; padding:6px 10px; }
  blockquote { border-left:3px solid #0071e3; padding-left:12px; color:#666; }
</style></head><body>${rendered}</body></html>`);
      printWin.document.close();
      printWin.focus();
      // 等渲染完成再触发打印
      setTimeout(() => {
        printWin.print();
      }, 500);
      return { success: true };
    },

    /** 下载 Blob 工具方法 */
    _downloadBlob(content, fileName, mimeType) {
      const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  };

  // 挂载为 electronAPI（现有代码无感使用）
  window.electronAPI = WebAPI;
})();
