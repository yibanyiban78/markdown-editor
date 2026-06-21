const OutlineManager = {
  userVisible: false,
  headings: [],
  activeHeadingId: null,
  pendingActiveUpdate: false,

  init() {
    document.getElementById('btn-close-outline').addEventListener('click', () => this.hide());
    document.getElementById('btn-outline').addEventListener('click', () => this.toggle());
    this.bindScrollTracking();
  },

  isVisible() {
    return !document.getElementById('outline-panel').classList.contains('hidden');
  },

  show() {
    this.userVisible = true;
    document.getElementById('outline-panel').classList.remove('hidden');
    this.requestActiveUpdate();
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

  showForDocument(markdownContent) {
    this.userVisible = true;
    if (!this.update(markdownContent)) this.hide();
  },

  update(markdownContent) {
    const content = document.getElementById('outline-content');
    content.innerHTML = '';
    this.headings = [];
    this.activeHeadingId = null;

    if (!markdownContent) {
      this.hide();
      return false;
    }

    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    let match;

    while ((match = headingRegex.exec(markdownContent)) !== null) {
      const heading = {
        id: `heading-${this.headings.length}`,
        index: this.headings.length,
        level: match[1].length,
        title: match[2].trim(),
        line: markdownContent.substring(0, match.index).split('\n').length,
        start: match.index,
        source: match[0]
      };
      this.headings.push(heading);

      const item = document.createElement('div');
      item.className = `outline-item outline-h${heading.level}`;
      item.textContent = heading.title;
      item.dataset.outlineId = heading.id;
      item.addEventListener('click', () => this.scrollToHeading(heading.id));
      content.appendChild(item);
    }

    if (!this.headings.length) {
      this.hide();
      return false;
    }

    if (this.userVisible) {
      document.getElementById('outline-panel').classList.remove('hidden');
      this.requestActiveUpdate();
    }
    return true;
  },

  bindScrollTracking() {
    ['single-preview', 'preview-pane', 'source-textarea', 'source-full'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('scroll', () => this.requestActiveUpdate());
    });
  },

  requestActiveUpdate() {
    if (this.pendingActiveUpdate) return;
    this.pendingActiveUpdate = true;
    requestAnimationFrame(() => {
      this.pendingActiveUpdate = false;
      this.updateActiveFromView();
    });
  },

  updateActiveFromView() {
    if (!this.headings.length || typeof Editor === 'undefined' || !Editor.hasOpenDocument) {
      this.setActiveHeading(null);
      return;
    }

    let activeId = null;
    if (Editor.currentMode === 'single') {
      activeId = this.getActiveHeadingFromPreview('single-preview');
    } else if (Editor.currentMode === 'split') {
      activeId = this.getActiveHeadingFromPreview('preview-pane') ||
        this.getActiveHeadingFromTextarea('source-textarea');
    } else if (Editor.currentMode === 'source') {
      activeId = this.getActiveHeadingFromTextarea('source-full');
    }

    this.setActiveHeading(activeId);
  },

  getActiveHeadingFromPreview(paneId) {
    const pane = document.getElementById(paneId);
    if (!pane || pane.offsetParent === null) return null;

    const renderedHeadings = Array.from(pane.querySelectorAll('h1, h2, h3'));
    if (!renderedHeadings.length) return null;

    const paneRect = pane.getBoundingClientRect();
    const threshold = paneRect.top + Math.min(96, pane.clientHeight * 0.25);
    let activeIndex = 0;

    for (let i = 0; i < renderedHeadings.length && i < this.headings.length; i++) {
      if (renderedHeadings[i].getBoundingClientRect().top <= threshold) {
        activeIndex = i;
      } else {
        break;
      }
    }

    return this.headings[activeIndex]?.id || null;
  },

  getActiveHeadingFromTextarea(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea || textarea.offsetParent === null) return null;

    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    const visibleLine = Math.max(1, Math.floor(textarea.scrollTop / lineHeight) + 1);
    const targetLine = visibleLine + 2;
    let activeHeading = this.headings[0];

    for (const heading of this.headings) {
      if (heading.line <= targetLine) {
        activeHeading = heading;
      } else {
        break;
      }
    }

    return activeHeading?.id || null;
  },

  setActiveHeading(headingId) {
    if (this.activeHeadingId === headingId) return;

    if (this.activeHeadingId) {
      const previous = document.querySelector(`[data-outline-id="${this.activeHeadingId}"]`);
      if (previous) previous.classList.remove('active');
    }

    this.activeHeadingId = headingId;

    if (!headingId) return;
    const current = document.querySelector(`[data-outline-id="${headingId}"]`);
    if (!current) return;

    current.classList.add('active');
    if (this.isVisible()) current.scrollIntoView({ block: 'nearest' });
  },

  _scrollTextareaToLine(textarea, lineNum) {
    if (!textarea) return;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    textarea.scrollTop = Math.max(0, lineNum - 3) * lineHeight;
  },

  scrollToHeading(headingId) {
    const heading = this.headings.find(item => item.id === headingId) ||
      this.headings.find(item => item.title === headingId);
    if (!heading) return;

    ['single-preview', 'preview-pane'].forEach(paneId => {
      const pane = document.getElementById(paneId);
      if (!pane || pane.offsetParent === null) return;

      const target = pane.querySelectorAll('h1, h2, h3')[heading.index];
      if (!target) return;

      const paneRect = pane.getBoundingClientRect();
      const headingRect = target.getBoundingClientRect();
      const relativeTop = Math.round(headingRect.top - paneRect.top);
      const relativeBottom = Math.round(headingRect.bottom - paneRect.bottom);

      if (relativeTop >= 0 && relativeBottom <= 0) return;

      const maxScroll = pane.scrollHeight - pane.clientHeight;
      if (relativeTop < 0) {
        pane.scrollTop = Math.max(0, pane.scrollTop + relativeTop - 12);
      } else {
        pane.scrollTop = Math.min(pane.scrollTop + relativeBottom + 12, maxScroll);
      }
    });

    this._scrollTextareaToLine(document.getElementById('source-textarea'), heading.line);
    this._scrollTextareaToLine(document.getElementById('source-full'), heading.line);

    const sourceFull = document.getElementById('source-full');
    const sourceTextarea = document.getElementById('source-textarea');
    const activeTextarea = sourceFull.offsetParent !== null
      ? sourceFull
      : (sourceTextarea.offsetParent !== null ? sourceTextarea : null);

    if (activeTextarea) {
      activeTextarea.focus();
      activeTextarea.setSelectionRange(heading.start, heading.start + heading.source.length);
    }

    this.setActiveHeading(heading.id);
    this.requestActiveUpdate();
  }
};
