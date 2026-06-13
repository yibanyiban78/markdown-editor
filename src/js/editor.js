const Editor = {
  currentMode: 'single',   // 'single' | 'split' | 'source'
  currentContent: '',
  currentFilePath: null,
  currentFileName: '',
  isDirty: false,
  autoSaveEnabled: true,
  autoSaveTimer: null,
  scrollRatio: 0,           // 0~1，记录当前滚动比例
  _splitSyncing: false,     // 防止双模同步死循环

  init() {
    this.bindToolbar();
    this.bindModeButtons();
    this.bindContentEvents();
    this.loadSettings();
    this.updateWelcomeVisibility();
  },

  updateWelcomeVisibility() {
    const welcome = document.getElementById('welcome-screen');
    const hasContent = this.currentContent && this.currentContent.trim() !== '';

    if (hasContent) {
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

  setContent(content, fileName, filePath) {
    this.currentContent = content || '';
    this.currentFileName = fileName || '';
    this.currentFilePath = filePath || null;

    document.getElementById('file-name-display').textContent = this.currentFileName || '';

    document.getElementById('source-textarea').value = content || '';
    document.getElementById('source-full').value = content || '';

    this.renderSinglePreview(content || '');
    this.updatePreview(content || '');
    this.isDirty = false;
    this.updateWordCount();
    if (typeof OutlineManager !== 'undefined') OutlineManager.update(this.currentContent);
    this.updateWelcomeVisibility();
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

    if (this.autoSaveEnabled) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = setTimeout(() => this.autoSave(), 1500);
    }
  },

  async autoSave() {
    if (!this.currentFilePath || !this.isDirty) return;
    const result = await window.electronAPI.saveDirect({
      content: this.currentContent,
      filePath: this.currentFilePath
    });
    if (result && result.success) {
      this.isDirty = false;
      document.getElementById('status-text').textContent = '已自动保存';
      setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 2000);
    }
  },

  newFile() {
    this.currentContent = '';
    this.currentFilePath = null;
    this.currentFileName = '';
    document.getElementById('file-name-display').textContent = '';
    document.getElementById('source-textarea').value = '';
    document.getElementById('source-full').value = '';
    document.getElementById('preview-pane').innerHTML = '';
    document.getElementById('single-preview').innerHTML = '';
    this.isDirty = false;
    this.updateWordCount();
    this.updateWelcomeVisibility();
  },

  async saveFile() {
    const result = await window.electronAPI.saveFile({
      content: this.currentContent,
      filePath: this.currentFilePath
    });
    if (result && result.success) {
      this.currentFilePath = result.filePath;
      this.currentFileName = result.fileName;
      document.getElementById('file-name-display').textContent = this.currentFileName;
      this.isDirty = false;
      document.getElementById('status-text').textContent = '已保存';
      setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 2000);
    }
  },

  async openFile(filePath) {
    if (filePath) {
      const result = await window.electronAPI.readFile(filePath);
      if (result) {
        this.setContent(result.content, result.fileName, result.filePath);
        document.getElementById('status-text').textContent = `已打开: ${result.fileName}`;
        return true;
      }
    } else {
      const result = await window.electronAPI.openFile();
      if (result) {
        this.setContent(result.content, result.fileName, result.filePath);
        document.getElementById('status-text').textContent = `已打开: ${result.fileName}`;
        return true;
      }
    }
    return false;
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
    const settings = saved ? JSON.parse(saved) : {};
    settings.fontSize = newSize;
    localStorage.setItem('editorSettings', JSON.stringify(settings));
    document.getElementById('status-text').textContent = `字体: ${newSize}px`;
    setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 1500);
  },

  updateSaveButtonVisibility() {
    document.getElementById('btn-save').style.display = this.autoSaveEnabled ? 'none' : '';
  }
};
