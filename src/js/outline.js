const OutlineManager = {
  userVisible: false,

  init() {
    document.getElementById('btn-close-outline').addEventListener('click', () => this.hide());
    document.getElementById('btn-outline').addEventListener('click', () => this.toggle());
  },

  isVisible() {
    return !document.getElementById('outline-panel').classList.contains('hidden');
  },

  show() {
    this.userVisible = true;
    document.getElementById('outline-panel').classList.remove('hidden');
  },

  hide() {
    this.userVisible = false;
    document.getElementById('outline-panel').classList.add('hidden');
  },

  toggle() {
    const panel = document.getElementById('outline-panel');
    if (panel.classList.contains('hidden')) {
      if (this.update(Editor.currentContent)) this.show();
    } else {
      this.hide();
    }
  },

  update(markdownContent) {
    const content = document.getElementById('outline-content');
    content.innerHTML = '';

    if (!markdownContent) {
      this.hide();
      return false;
    }

    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    let match;
    let hasHeadings = false;

    while ((match = headingRegex.exec(markdownContent)) !== null) {
      hasHeadings = true;
      const level = match[1].length;
      const title = match[2].trim();

      const item = document.createElement('div');
      item.className = `outline-item outline-h${level}`;
      item.textContent = title;

      item.addEventListener('click', () => {
        this.scrollToHeading(title);
      });

      content.appendChild(item);
    }

    if (!hasHeadings) {
      this.hide();
    } else if (this.userVisible) {
      document.getElementById('outline-panel').classList.remove('hidden');
    }
    return hasHeadings;
  },

  /**
   * 查找标题在源码中的行号（1-based）
   */
  _findHeadingLine(titleText) {
    const content = Editor.currentContent || '';
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      if (match[2].trim() === titleText) {
        return content.substring(0, match.index).split('\n').length;
      }
    }
    return -1;
  },

  /**
   * 滚动源码 textarea 到指定行
   */
  _scrollTextareaToLine(ta, lineNum) {
    if (!ta) return;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 20;
    ta.scrollTop = Math.max(0, (lineNum - 3)) * lineHeight;
  },

  scrollToHeading(titleText) {
    // 1. 处理预览区（单栏和双栏模式）
    const panes = ['single-preview', 'preview-pane'];
    for (const paneId of panes) {
      const pane = document.getElementById(paneId);
      if (!pane || pane.offsetParent === null) continue;
      const headings = pane.querySelectorAll('h1, h2, h3');
      for (const h of headings) {
        if (h.textContent.trim() === titleText) {
          const paneRect = pane.getBoundingClientRect();
          const headingRect = h.getBoundingClientRect();
          const relativeTop = Math.round(headingRect.top - paneRect.top);
          const relativeBottom = Math.round(headingRect.bottom - paneRect.bottom);

          if (relativeTop >= 0 && relativeBottom <= 0) break;

          const maxScroll = pane.scrollHeight - pane.clientHeight;

          if (relativeTop < 0) {
            pane.scrollTop = Math.max(0, pane.scrollTop + relativeTop - 12);
          } else {
            const scrollTarget = pane.scrollTop + relativeBottom + 12;
            pane.scrollTop = Math.min(scrollTarget, maxScroll);
          }
          break;
        }
      }
    }

    // 2. 处理源码区（双栏和源码模式）：查找标题行号并滚动 textarea
    const lineNum = this._findHeadingLine(titleText);
    if (lineNum > 0) {
      this._scrollTextareaToLine(document.getElementById('source-textarea'), lineNum);
      this._scrollTextareaToLine(document.getElementById('source-full'), lineNum);

      // 在源码区选中标题对应的文本
      const activeTextarea = document.getElementById('source-full').offsetParent !== null
        ? document.getElementById('source-full')
        : (document.getElementById('source-textarea').offsetParent !== null
          ? document.getElementById('source-textarea')
          : null);
      if (activeTextarea) {
        const content = Editor.currentContent || '';
        const escapedTitle = titleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const headingRegex = new RegExp(`^#{1,3}\\s+${escapedTitle}$`, 'gm');
        const match = headingRegex.exec(content);
        if (match) {
          activeTextarea.focus();
          activeTextarea.setSelectionRange(match.index, match.index + match[0].length);
        }
      }
    }
  }
};
