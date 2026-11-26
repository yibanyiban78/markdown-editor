const MarkdownRenderer = {
  sanitizeHtml(html, allowGeneratedStyles = false, imageDocumentId) {
    if (typeof DOMPurify === 'undefined') {
      return this.escapeHtml(html);
    }

    const options = {
      USE_PROFILES: { html: true, mathMl: true },
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'video', 'audio'],
      ALLOW_DATA_ATTR: true
    };
    if (!allowGeneratedStyles) options.FORBID_ATTR = ['style'];

    const cleanHtml = DOMPurify.sanitize(html, options);

    // Work in inert template content so intermediate src values never load against the app page.
    const template = document.createElement('template');
    template.innerHTML = cleanHtml;
    const container = template.content;

    container.querySelectorAll('a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const isAllowed = href.startsWith('#') ||
        /^https?:\/\//i.test(href) ||
        /^mailto:/i.test(href);

      if (!isAllowed) {
        link.removeAttribute('href');
        link.removeAttribute('target');
        return;
      }

      if (/^https?:\/\//i.test(href)) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });

    container.querySelectorAll('img').forEach((image) => {
      const src = (image.getAttribute('src') || '').trim();
      if (/^\s*(javascript|vbscript):/i.test(src)) {
        image.removeAttribute('src');
      } else if (imageDocumentId !== undefined && src && !/^(https?:|data:)/i.test(src)) {
        // Exports retain relative URLs. Live previews use only the context assigned by the main process.
        const relative = !/^(?:[a-z][\w+.-]*:|[\\/#?])/i.test(src);
        if (relative && imageDocumentId) {
          image.setAttribute('src', `md-image://${imageDocumentId}/?${new URLSearchParams({ src })}`);
        } else {
          image.removeAttribute('src');
          image.classList.add('image-load-error');
          if (relative) image.alt = `[请先保存文档以预览本地图片: ${image.alt || src}]`;
        }
      }
      image.removeAttribute('srcset');
    });

    return template.innerHTML;
  },

  render(markdownText, imageDocumentId) {
    if (!markdownText || markdownText.trim() === '') {
      return '<p class="empty-preview">暂无内容</p>';
    }

    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
      return `<pre>${this.escapeHtml(markdownText)}</pre>`;
    }

    const parsedHtml = marked.parse(markdownText, { breaks: true, gfm: true });
    const template = document.createElement('template');
    template.innerHTML = this.sanitizeHtml(parsedHtml);

    this.processMath(template.content);
    this.processCodeBlocks(template.content);

    return this.sanitizeHtml(template.innerHTML, true, imageDocumentId);
  },

  processMath(container) {
    if (typeof katex === 'undefined') return;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;

    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || parent.closest('pre, code, .katex, .mermaid')) continue;
      if (node.textContent.includes('$')) textNodes.push(node);
    }

    const formulaPattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

    textNodes.forEach((textNode) => {
      const text = textNode.textContent;
      let cursor = 0;
      let match;
      let changed = false;
      const fragment = document.createDocumentFragment();

      formulaPattern.lastIndex = 0;
      while ((match = formulaPattern.exec(text)) !== null) {
        changed = true;
        if (match.index > cursor) {
          fragment.appendChild(document.createTextNode(text.slice(cursor, match.index)));
        }

        const formula = match[1] || match[2] || '';
        const displayMode = Boolean(match[1]);
        const wrapper = document.createElement(displayMode ? 'div' : 'span');
        wrapper.className = displayMode ? 'math-display' : 'math-inline';

        try {
          const renderedFormula = katex.renderToString(formula.trim(), {
            displayMode,
            throwOnError: false,
            strict: 'warn',
            trust: false
          });
          const template = document.createElement('template');
          template.innerHTML = renderedFormula;
          wrapper.appendChild(template.content);
        } catch {
          wrapper.className = 'math-error';
          wrapper.textContent = match[0];
        }

        fragment.appendChild(wrapper);
        cursor = match.index + match[0].length;
      }

      if (!changed) return;
      if (cursor < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(cursor)));
      }
      textNode.replaceWith(fragment);
    });
  },

  processCodeBlocks(container) {
    container.querySelectorAll('pre').forEach((pre) => {
      const code = pre.querySelector(':scope > code');
      if (!code) return;

      let language = '';
      const className = code.getAttribute('class') || '';
      const match = className.match(/language-([\w-]+)/);
      if (match) language = match[1];

      if (typeof hljs !== 'undefined' && language && language !== 'mermaid') {
        try {
          code.innerHTML = hljs.highlight(code.textContent, {
            language,
            ignoreIllegals: true
          }).value;
          code.classList.add('hljs');
        } catch {
          code.textContent = code.textContent;
        }
      }

      pre.classList.add('code-block');
      if (language === 'mermaid') return;

      const header = document.createElement('div');
      header.className = 'code-block-header';

      const languageLabel = document.createElement('span');
      languageLabel.className = 'code-lang-label';
      languageLabel.textContent = language || 'code';

      const copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.className = 'code-copy-btn';
      copyButton.textContent = '复制';

      header.append(languageLabel, copyButton);
      pre.insertBefore(header, pre.firstChild);
    });
  },

  async postRender(container) {
    this.bindCopyButtons(container);

    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        htmlLabels: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default'
      });

      const blocks = Array.from(container.querySelectorAll('.language-mermaid'));
      for (const block of blocks) {
        const diagram = document.createElement('div');
        diagram.className = 'mermaid';
        diagram.id = `mermaid-${crypto.randomUUID()}`;
        diagram.textContent = block.textContent;

        const pre = block.closest('pre');
        if (pre) pre.replaceWith(diagram);
        else block.replaceWith(diagram);

        try {
          await mermaid.run({ nodes: [diagram], suppressErrors: true });
        } catch {
          diagram.classList.add('mermaid-error');
          diagram.textContent = 'Mermaid 图表语法错误';
        }
      }
    }

    container.querySelectorAll('img').forEach((image) => {
      image.addEventListener('error', () => {
        image.classList.add('image-load-error');
        image.alt = `[图片加载失败: ${image.alt || image.src}]`;
      }, { once: true });
    });
  },

  bindCopyButtons(container) {
    container.querySelectorAll('.code-copy-btn').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const code = button.closest('pre')?.querySelector('code');
        if (!code) return;

        try {
          await navigator.clipboard.writeText(code.textContent);
          button.textContent = '已复制';
          setTimeout(() => { button.textContent = '复制'; }, 2000);
        } catch {
          button.textContent = '复制失败';
          setTimeout(() => { button.textContent = '复制'; }, 2000);
        }
      });
    });
  },

  async renderForExport(markdownText) {
    const container = document.createElement('article');
    container.className = 'markdown-export';
    container.innerHTML = this.render(markdownText);
    document.body.appendChild(container);

    try {
      await this.postRender(container);
      container.querySelectorAll('.code-block-header').forEach((header) => header.remove());
      container.querySelectorAll('button').forEach((button) => button.remove());
      return container.innerHTML;
    } finally {
      container.remove();
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }
};
