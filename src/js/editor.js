const Editor = {
  currentMode: 'single',   // 'single' | 'split' | 'source'
  currentContent: '',
  currentDocumentId: null,
  currentFileName: '',
  hasOpenDocument: false,
  isDirty: false,
  autoSaveEnabled: true,
  autoSaveTimer: null,
  revision: 0,
  documentGeneration: 0,
  scrollRatio: 0,           // 0~1，记录当前滚动比例
  _splitSyncing: false,     // 防止双模同步死循环

  init() {
    this.bindToolbar();
    this.bindModeButtons();
    this.bindContentEvents();
    this.loadSettings();
    this.updateWelcomeVisibility();
    this.bindSampleButton();
  },

  bindSampleButton() {
    const btn = document.getElementById('btn-open-sample');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (!await this.prepareToReplaceDocument('打开示例文档')) return;
        this.setContent(this.getSampleContent(), '示例文档.md', null);
        this.switchMode('single');
      });
    }
  },

  getSampleContent() {
    return `# 极简Markdown编辑器 — 使用示例

## 欢迎！🎉

这是一份功能展示文档，帮助你快速了解编辑器的所有能力。

---

## 文字排版

**粗体** · *斜体* · ~~删除线~~ · \`行内代码\` · [链接](https://github.com/yibanyiban78/markdown-editor)

> 这是一段引用文字。引用可以嵌套，用于强调或引用他人内容。

有序列表：
1. 第一项
2. 第二项
3. 第三项

无序列表：
- 苹果
- 香蕉
- 草莓

任务列表：
- [x] 已完成任务
- [ ] 未完成任务

---

## 代码高亮 ⚡

\`\`\`javascript
function hello() {
  console.log("Hello, Markdown!");
}
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        print(a, end=' ')
        a, b = b, a + b
\`\`\`

---

## 数学公式 📐

行内公式：$E = mc^2$

独立公式：

$$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

---

## Mermaid 图表 📊

\`\`\`mermaid
flowchart LR
    A[开始] --> B{判断}
    B -- 是 --> C[执行]
    B -- 否 --> D[结束]
\`\`\`

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: 你好吗？
    Bob-->>Alice: 我很好！
\`\`\`

---

## 表格

| 功能 | 支持情况 | 说明 |
|------|---------|------|
| 语法高亮 | ✅ | 190+ 语言 |
| 数学公式 | ✅ | KaTeX 引擎 |
| 图表 | ✅ | Mermaid |
| 导出 HTML | ✅ | 带水印 |
| 导出 PDF | ✅ | 浏览器打印 |

---

> ✨ **提示**：按 \`Ctrl+O\` 打开自己的 .md 文件，按 \`Ctrl+S\` 保存。
>
> 本项目开源免费，欢迎 Star ⭐ → [GitHub 仓库](https://github.com/yibanyiban78/markdown-editor)
`;
  },

  updateWelcomeVisibility() {
    const welcome = document.getElementById('welcome-screen');

    if (this.hasOpenDocument) {
      welcome.classList.add('hidden');
      const paneIds = ['editor-single', 'editor-split', 'editor-source'];
      paneIds.forEach(id => {
        document.getElementById(id).classList.toggle('hidden', !id.includes(this.currentMode));
      });
    } else {
      welcome.classList.remove('hidden');
      ['editor-single', 'editor-split', 'editor-source'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
      });
    }
  },

  bindToolbar() {
    document.getElementById('btn-open-file').addEventListener('click', () => this.openFile());
    document.getElementById('btn-new-file').addEventListener('click', () => this.newFile());
    document.getElementById('btn-save').addEventListener('click', () => this.saveFile());
    document.getElementById('btn-font-plus').addEventListener('click', () => this.changeFontSize(1));
    document.getElementById('btn-font-minus').addEventListener('click', () => this.changeFontSize(-1));
  },

  bindModeButtons() {
    const modes = [
      { id: 'btn-mode-single', mode: 'single' },
      { id: 'btn-mode-split', mode: 'split' },
      { id: 'btn-mode-source', mode: 'source' }
    ];
    modes.forEach(({ id, mode }) => {
      document.getElementById(id).addEventListener('click', () => this.switchMode(mode));
    });
  },

  bindContentEvents() {
    const bindTextarea = (el) => {
      // 使用原生 e.isComposing 检测输入法组合状态，比手动标志位更可靠
      el.addEventListener('input', (e) => {
        if (e.isComposing) return; // IME 组合中→跳过
        this._handleInput(e.target.value);
      });

      // compositionend 触发时表示用户已确认选词
      // 有些平台不会在此之后触发 input(isComposing=false)，所以在此处理
      el.addEventListener('compositionend', () => {
        this._handleInput(el.value);
      });
    };

    bindTextarea(document.getElementById('source-textarea'));
    bindTextarea(document.getElementById('source-full'));
  },

  /** input 事件统一处理逻辑 */
  _handleInput(value) {
    this.currentContent = value;
    this.isDirty = true;
    this.revision++;
    this.updatePreview(value);
    this.onContentChange();
  },

  /** 获取当前可见的区域（用于记录 scrollRatio） */
  getVisibleScrollPane() {
    if (this.currentMode === 'single') return document.getElementById('single-preview');
    if (this.currentMode === 'split') return document.getElementById('preview-pane');
    if (this.currentMode === 'source') return document.getElementById('source-full');
    return null;
  },

  /** 记录当前可见区域的滚动比例 */
  captureScrollRatio() {
    const pane = this.getVisibleScrollPane();
    if (pane) {
      const maxScroll = pane.scrollHeight - pane.clientHeight;
      this.scrollRatio = maxScroll > 0 ? pane.scrollTop / maxScroll : 0;
    }
  },

  /** 恢复滚动比例到目标元素 */
  applyScrollRatio(el) {
    if (!el) return;
    requestAnimationFrame(() => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll > 0) {
        el.scrollTop = this.scrollRatio * maxScroll;
      }
    });
  },

  switchMode(mode) {
    const welcome = document.getElementById('welcome-screen');
    if (!welcome.classList.contains('hidden')) return;

    // 切换前记录当前滚动比例
    this.captureScrollRatio();

    this.currentMode = mode;

    ['btn-mode-single', 'btn-mode-split', 'btn-mode-source'].forEach(id => {
      document.getElementById(id).classList.remove('active');
    });
    document.getElementById(`btn-mode-${mode}`).classList.add('active');

    ['editor-single', 'editor-split', 'editor-source'].forEach(id => {
      document.getElementById(id).classList.toggle('hidden', !id.includes(mode));
    });

    if (mode === 'single') {
      this.renderSinglePreview(this.currentContent);
      this.applyScrollRatio(document.getElementById('single-preview'));
    } else if (mode === 'split') {
      this.unbindSplitScroll();
      document.getElementById('source-textarea').value = this.currentContent;
      this.updatePreview(this.currentContent);
      // 双模渲染后同步滚动位置，然后绑定互相同步
      requestAnimationFrame(() => {
        this.syncSplitScrollToRatio();
        this.bindSplitScroll();
      });
    } else if (mode === 'source') {
      document.getElementById('source-full').value = this.currentContent;
      this.applyScrollRatio(document.getElementById('source-full'));
    }
  },

  // ========== 双模同步滚动 ==========

  /** 按记录的 scrollRatio 同步双模两侧 */
  syncSplitScrollToRatio() {
    const preview = document.getElementById('preview-pane');
    const textarea = document.getElementById('source-textarea');
    if (preview) {
      const maxP = preview.scrollHeight - preview.clientHeight;
      preview.scrollTop = maxP > 0 ? this.scrollRatio * maxP : 0;
    }
    if (textarea) {
      const maxT = textarea.scrollHeight - textarea.clientHeight;
      textarea.scrollTop = maxT > 0 ? this.scrollRatio * maxT : 0;
    }
  },

  bindSplitScroll() {
    this._splitSyncing = false;
    const preview = document.getElementById('preview-pane');
    const textarea = document.getElementById('source-textarea');
    if (!preview || !textarea) return;

    // 存储 handler 以便解绑
    this._onPreviewScroll = () => {
      if (this._splitSyncing) return;
      this._splitSyncing = true;
      const maxP = preview.scrollHeight - preview.clientHeight;
      const ratio = maxP > 0 ? preview.scrollTop / maxP : 0;
      const maxT = textarea.scrollHeight - textarea.clientHeight;
      textarea.scrollTop = maxT > 0 ? ratio * maxT : 0;
      this.scrollRatio = ratio;
      requestAnimationFrame(() => { this._splitSyncing = false; });
    };

    this._onTextareaScroll = () => {
      if (this._splitSyncing) return;
      this._splitSyncing = true;
      const maxT = textarea.scrollHeight - textarea.clientHeight;
      const ratio = maxT > 0 ? textarea.scrollTop / maxT : 0;
      const maxP = preview.scrollHeight - preview.clientHeight;
      preview.scrollTop = maxP > 0 ? ratio * maxP : 0;
      this.scrollRatio = ratio;
      requestAnimationFrame(() => { this._splitSyncing = false; });
    };

    preview.addEventListener('scroll', this._onPreviewScroll);
    textarea.addEventListener('scroll', this._onTextareaScroll);
  },

  unbindSplitScroll() {
    const preview = document.getElementById('preview-pane');
    const textarea = document.getElementById('source-textarea');
    if (preview && this._onPreviewScroll) preview.removeEventListener('scroll', this._onPreviewScroll);
    if (textarea && this._onTextareaScroll) textarea.removeEventListener('scroll', this._onTextareaScroll);
  },

  // ========== 渲染 ==========

  renderSinglePreview(markdownText) {
    const pane = document.getElementById('single-preview');
    if (typeof MarkdownRenderer !== 'undefined') {
      pane.innerHTML = MarkdownRenderer.render(markdownText || '');
      MarkdownRenderer.postRender(pane);
    } else {
      pane.textContent = markdownText || '';
    }
    if (SearchManager && SearchManager.searchQuery) {
      setTimeout(() => SearchManager.updatePreviewHighlights(), 300);
    }
  },

  getContent() {
    if (this.currentMode === 'split') {
      return document.getElementById('source-textarea').value;
    } else if (this.currentMode === 'source') {
      return document.getElementById('source-full').value;
    }
    return this.currentContent;
  },

  setContent(content, fileName, documentId) {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = null;
    this.documentGeneration++;
    this.revision++;
    this.currentContent = content || '';
    this.currentFileName = fileName || '';
    this.currentDocumentId = documentId || null;
    this.hasOpenDocument = true;

    document.getElementById('file-name-display').textContent = this.currentFileName || '';

    document.getElementById('source-textarea').value = content || '';
    document.getElementById('source-full').value = content || '';

    this.renderSinglePreview(content || '');
    this.updatePreview(content || '');
    this.isDirty = false;
    this.updateWordCount();
    if (typeof OutlineManager !== 'undefined') OutlineManager.update(this.currentContent);
    this.updateWelcomeVisibility();
    this.updateSaveButtonVisibility();
  },

  updatePreview(markdownText) {
    const previewPane = document.getElementById('preview-pane');
    if (typeof MarkdownRenderer !== 'undefined') {
      previewPane.innerHTML = MarkdownRenderer.render(markdownText);
      MarkdownRenderer.postRender(previewPane);
    } else {
      previewPane.textContent = markdownText;
    }
    if (SearchManager && SearchManager.searchQuery) {
      setTimeout(() => SearchManager.updatePreviewHighlights(), 300);
    }
  },

  onContentChange() {
    this.updateWordCount();
    if (typeof OutlineManager !== 'undefined') OutlineManager.update(this.currentContent);

    if (this.autoSaveEnabled && this.currentDocumentId) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = setTimeout(() => this.autoSave(), 1500);
    }
  },

  async autoSave(silent = false) {
    if (!this.currentDocumentId || !this.isDirty) return !this.isDirty;

    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = null;
    const revision = this.revision;
    const generation = this.documentGeneration;
    const documentId = this.currentDocumentId;
    const content = this.currentContent;

    const result = await window.electronAPI.saveDirect({
      content,
      documentId
    });

    const isCurrentVersion = this.revision === revision &&
      this.documentGeneration === generation &&
      this.currentDocumentId === documentId;

    if (result && result.success && isCurrentVersion) {
      this.isDirty = false;
      if (!silent) this.showStatus('已自动保存');
      return true;
    }

    if (result && result.success && this.currentDocumentId === documentId) {
      this.scheduleAutoSave();
    } else if (!silent) {
      this.showStatus('自动保存失败');
    }
    return false;
  },

  scheduleAutoSave() {
    if (!this.autoSaveEnabled || !this.currentDocumentId || !this.isDirty) return;
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = setTimeout(() => this.autoSave(), 1500);
  },

  async prepareToReplaceDocument(action) {
    clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = null;
    if (!this.isDirty) return true;

    if (this.autoSaveEnabled && this.currentDocumentId && await this.autoSave(true)) {
      return true;
    }

    return window.confirm(`当前文档有未保存的修改。确定要${action}并放弃这些修改吗？`);
  },

  async requestClose() {
    if (await this.prepareToReplaceDocument('关闭应用')) {
      window.electronAPI.confirmClose();
    }
  },

  async newFile() {
    if (!await this.prepareToReplaceDocument('新建文档')) return false;
    this.setContent('', '', null);
    this.switchMode('source');
    return true;
  },

  async saveFile() {
    const revision = this.revision;
    const generation = this.documentGeneration;
    const result = await window.electronAPI.saveFile({
      content: this.currentContent,
      documentId: this.currentDocumentId,
      fileName: this.currentFileName
    });

    if (result && result.success) {
      this.currentDocumentId = result.documentId;
      this.currentFileName = result.fileName;
      document.getElementById('file-name-display').textContent = this.currentFileName;
      this.updateSaveButtonVisibility();
      this.isDirty = this.revision !== revision || this.documentGeneration !== generation;
      this.showStatus('已保存');
      if (this.isDirty) this.scheduleAutoSave();
      return true;
    }
    if (result && result.error) this.showStatus('保存失败');
    return false;
  },

  async openFile() {
    const result = await window.electronAPI.openFile();
    if (!result) return false;
    if (!await this.prepareToReplaceDocument('打开其他文档')) return false;

    this.setContent(result.content, result.fileName, result.documentId);
    this.showStatus(`已打开: ${result.fileName}`);
    return true;
  },

  async openExternalDocument(data) {
    if (!data || typeof data.content !== 'string') return false;
    if (!await this.prepareToReplaceDocument('打开其他文档')) return false;

    this.setContent(data.content, data.fileName, data.documentId || null);
    this.showStatus(`已打开: ${data.fileName}`);
    return true;
  },

  async openDroppedFile(file) {
    if (!file || !/\.(md|markdown|txt)$/i.test(file.name)) return false;
    if (file.size > 20 * 1024 * 1024) {
      this.showStatus('文件过大，无法打开');
      return false;
    }

    const content = await file.text();
    if (!await this.prepareToReplaceDocument('打开拖入的文档')) return false;

    // 拖入文件不授予静默写回权限，首次保存时由系统保存对话框确认目标。
    this.setContent(content, file.name, null);
    this.showStatus(`已打开: ${file.name}`);
    return true;
  },

  updateWordCount() {
    const text = this.currentContent || '';
    const charCount = text.length;
    const wordCount = text.replace(/\s/g, '').length;
    document.getElementById('word-count').textContent = `字数: ${wordCount} | 字符: ${charCount}`;
  },

  loadSettings() {
    const saved = localStorage.getItem('editorSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        this.autoSaveEnabled = settings.autoSave !== false;
        if (settings.fontSize) {
          document.documentElement.style.setProperty('--editor-font-size', settings.fontSize + 'px');
        }
      } catch(e) {}
    }
    this.updateSaveButtonVisibility();
  },

  changeFontSize(delta) {
    const root = document.documentElement;
    const current = parseFloat(getComputedStyle(root).getPropertyValue('--editor-font-size').trim()) || 15;
    let newSize = Math.max(11, Math.min(24, current + delta));
    root.style.setProperty('--editor-font-size', newSize + 'px');

    const saved = localStorage.getItem('editorSettings');
    let settings = {};
    try {
      settings = saved ? JSON.parse(saved) : {};
    } catch {
      settings = {};
    }
    settings.fontSize = newSize;
    localStorage.setItem('editorSettings', JSON.stringify(settings));
    document.getElementById('status-text').textContent = `字体: ${newSize}px`;
    setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 1500);
  },

  updateSaveButtonVisibility() {
    const needsFirstSave = this.hasOpenDocument && !this.currentDocumentId;
    document.getElementById('btn-save').style.display =
      this.autoSaveEnabled && !needsFirstSave ? 'none' : '';
  },

  showStatus(message, duration = 2000) {
    const status = document.getElementById('status-text');
    status.textContent = message;
    setTimeout(() => {
      if (status.textContent === message) status.textContent = '就绪';
    }, duration);
  }
};
