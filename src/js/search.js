const SearchManager = {
  matches: [],
  currentMatchIndex: -1,
  searchQuery: '',

  init() {
    document.getElementById('btn-search').addEventListener('click', () => this.toggleSearch());
    document.getElementById('search-close').addEventListener('click', () => this.hideSearch());
    document.getElementById('search-input').addEventListener('input', (e) => {
      if (e.isComposing) return;
      this.search(e.target.value);
    });
    document.getElementById('search-input').addEventListener('compositionend', () => {
      this.search(document.getElementById('search-input').value);
    });
    document.getElementById('search-input').addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter') {
        e.shiftKey ? this.prev() : this.next();
      }
    });
    document.getElementById('search-prev').addEventListener('click', () => this.prev());
    document.getElementById('search-next').addEventListener('click', () => this.next());
  },

  toggleSearch() {
    const bar = document.getElementById('search-bar');
    bar.classList.toggle('hidden');
    if (!bar.classList.contains('hidden')) {
      document.getElementById('search-input').focus();
      document.getElementById('search-input').value = '';
      this.matches = [];
      this.currentMatchIndex = -1;
      this.searchQuery = '';
      document.getElementById('search-count').textContent = '';
      this.clearPreviewHighlights();
    }
  },

  hideSearch() {
    document.getElementById('search-bar').classList.add('hidden');
    this.matches = [];
    this.currentMatchIndex = -1;
    this.searchQuery = '';
    document.getElementById('search-count').textContent = '';
    this.clearPreviewHighlights();
  },

  search(query) {
    this.searchQuery = query;

    if (!query || query.trim() === '') {
      document.getElementById('search-count').textContent = '';
      this.matches = [];
      this.clearPreviewHighlights();
      return;
    }

    const content = Editor.currentContent || '';
    if (!content) {
      document.getElementById('search-count').textContent = '';
      return;
    }

    this.matches = [];
    this.currentMatchIndex = -1;

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;
    while ((match = regex.exec(content)) !== null) {
      this.matches.push({ index: match.index, length: match[0].length });
    }

    if (this.matches.length === 0) {
      document.getElementById('search-count').textContent = '无匹配';
      this.clearPreviewHighlights();
      return;
    }

    this.currentMatchIndex = 0;
    this.updatePreviewHighlights();
    document.getElementById('search-count').textContent = `${this.currentMatchIndex + 1}/${this.matches.length}`;
  },

  /** 获取当前可见的预览区 */
  getVisiblePreviewPane() {
    const panes = ['single-preview', 'preview-pane'];
    for (const id of panes) {
      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  },

  /** 检查节点是否在 SVG 或 .mermaid 内部（这些区域不能插入 HTML <mark> 标签） */
  isInsideSvgOrMermaid(node) {
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    while (el) {
      if (el.tagName === 'SVG' || el.closest && el.closest('.mermaid')) return true;
      if (el.tagName === 'svg' || el.classList && el.classList.contains('mermaid')) return true;
      el = el.parentElement;
    }
    return false;
  },

  /** 在预览 DOM 中高亮当前匹配 */
  highlightCurrent() {
    if (this.currentMatchIndex < 0 || this.currentMatchIndex >= this.matches.length) return;
    this.updatePreviewHighlights();
  },

  /** 在预览区 DOM 中高亮所有匹配，跳过 SVG/Mermaid */
  updatePreviewHighlights() {
    this.clearPreviewHighlights();

    const query = this.searchQuery;
    if (!query) return;

    const content = Editor.currentContent || '';
    if (!content) return;

    // ===== 1. 预览区 DOM 高亮（仅在预览区可见时执行）=====
    const preview = this.getVisiblePreviewPane();
    if (preview) {
      // 收集所有不在 SVG/Mermaid 内的纯文本节点
      const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      while ((node = walker.nextNode())) {
        if (!this.isInsideSvgOrMermaid(node)) {
          textNodes.push(node);
        }
      }

      let matchIdx = 0;
      for (const textNode of textNodes) {
        const text = textNode.textContent;
        if (!text) continue;

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        let idx = 0;
        const fragments = [];
        let hasMatch = false;

        while (idx < text.length) {
          const found = lowerText.indexOf(lowerQuery, idx);
          if (found === -1) {
            fragments.push(document.createTextNode(text.substring(idx)));
            break;
          }
          hasMatch = true;

          if (found > idx) {
            fragments.push(document.createTextNode(text.substring(idx, found)));
          }

          const mark = document.createElement('mark');
          mark.className = matchIdx === this.currentMatchIndex ? 'search-highlight-current' : 'search-highlight';
          mark.textContent = text.substring(found, found + query.length);

          if (matchIdx === this.currentMatchIndex) {
            mark.id = 'search-current-match';
          }

          fragments.push(mark);
          idx = found + query.length;
          matchIdx++;

          if (matchIdx > this.matches.length) break;
        }

        if (hasMatch) {
          const parent = textNode.parentNode;
          for (const frag of fragments) {
            parent.insertBefore(frag, textNode);
          }
          parent.removeChild(textNode);
          parent.normalize();
        }
      }

      // 滚动预览区到当前匹配
      const currentEl = document.getElementById('search-current-match');
      if (currentEl) {
        currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        currentEl.removeAttribute('id');
      } else {
        const match = this.matches[this.currentMatchIndex];
        if (match) {
          const scrollRatio = match.index / content.length;
          preview.scrollTop = scrollRatio * (preview.scrollHeight - preview.clientHeight);
        }
      }
    }

    // ===== 2. 源码区 textarea 滚动和选中（所有模式下都执行）=====
    const currentMatch = this.matches[this.currentMatchIndex];
    if (currentMatch) {
      const textareas = [document.getElementById('source-textarea'), document.getElementById('source-full')];
      textareas.forEach(ta => {
        if (!ta || ta.offsetParent === null) return;
        const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
        const beforeMatch = content.substring(0, currentMatch.index);
        const lineNum = beforeMatch.split('\n').length;
        ta.scrollTop = Math.max(0, (lineNum - 5)) * lineHeight;
        ta.focus();
        ta.setSelectionRange(currentMatch.index, currentMatch.index + currentMatch.length);
      });
    }
  },

  /** 移除预览区中所有 <mark> 高亮 */
  clearPreviewHighlights() {
    const panes = ['single-preview', 'preview-pane'];
    panes.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const marks = el.querySelectorAll('.search-highlight, .search-highlight-current');
      marks.forEach(m => {
        const parent = m.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(m.textContent), m);
          parent.normalize();
        }
      });
    });
  },

  next() {
    if (this.matches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
    this.highlightCurrent();
    document.getElementById('search-count').textContent = `${this.currentMatchIndex + 1}/${this.matches.length}`;
  },

  prev() {
    if (this.matches.length === 0) return;
    this.currentMatchIndex = (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
    this.highlightCurrent();
    document.getElementById('search-count').textContent = `${this.currentMatchIndex + 1}/${this.matches.length}`;
  }
};
