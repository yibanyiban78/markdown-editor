const MarkdownRenderer = {
  /**
   * 渲染 Markdown 为 HTML（同步处理大部分内容）
   */
  render(markdownText) {
    if (!markdownText || markdownText.trim() === '') {
      return '<p style="color: var(--text-tertiary); text-align: center; padding: 40px;">暂无内容</p>';
    }

    // Step 1: marked 解析 Markdown → HTML
    let html;
    if (typeof marked !== 'undefined') {
      html = marked.parse(markdownText, { breaks: true, gfm: true });
    } else {
      html = `<pre>${this.escapeHtml(markdownText)}</pre>`;
      return html;
    }

    // Step 2: KaTeX 数学公式（在字符串层面替换）
    if (typeof katex !== 'undefined') {
      // 独立公式 $$...$$
      html = html.replace(/\$\$(.+?)\$\$/gs, (_, formula) => {
        try {
          return katex.renderToString(formula.trim(), {
            displayMode: true,
            throwOnError: false
          });
        } catch (e) {
          return `<code style="color:var(--md-code-color);background:var(--code-bg);padding:4px 8px;border-radius:4px;">$$\n${this.escapeHtml(formula)}\n$$</code>`;
        }
      });
      // 行内公式 $...$
      html = html.replace(/\$(.+?)\$/g, (_, formula) => {
        try {
          return katex.renderToString(formula.trim(), {
            displayMode: false,
            throwOnError: false
          });
        } catch (e) {
          return `<code style="color:var(--md-code-color);background:var(--code-bg);padding:2px 4px;border-radius:3px;">$${this.escapeHtml(formula)}$</code>`;
        }
      });
    }

    // Step 3: 代码块处理（添加语言标签 + highlight.js 高亮）
    html = this.processCodeBlocks(html);

    return html;
  },

  /**
   * 处理代码块：添加语言标签、语法高亮
   */
  processCodeBlocks(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    tempDiv.querySelectorAll('pre').forEach((pre) => {
      const code = pre.querySelector('code');
      if (!code) return;

      // 识别语言
      let lang = '';
      const classAttr = code.getAttribute('class') || '';
      const match = classAttr.match(/language-(\w+)/);
      if (match) lang = match[1];

      // 应用 highlight.js 高亮
      if (typeof hljs !== 'undefined' && lang) {
        try {
          code.innerHTML = hljs.highlight(code.textContent, { language: lang, ignoreIllegals: true }).value;
          code.classList.add('hljs');
        } catch (e) {
          // 回退：自动检测
          try {
            const result = hljs.highlightAuto(code.textContent);
            code.innerHTML = result.value;
            code.classList.add('hljs');
            if (!lang) lang = result.language;
          } catch (e2) {}
        }
      }

      // 给 <pre> 加样式包装
      pre.style.position = 'relative';

      // 创建代码块头部（语言标签 + 复制按钮）
      const header = document.createElement('div');
      header.className = 'code-block-header';

      const langLabel = document.createElement('span');
      langLabel.className = 'code-lang-label';
      langLabel.textContent = lang || 'code';
      header.appendChild(langLabel);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-btn';
      copyBtn.textContent = '📋 复制';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code.textContent).then(() => {
          copyBtn.textContent = '✅ 已复制';
          setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
        });
      });
      header.appendChild(copyBtn);

      pre.insertBefore(header, pre.firstChild);
    });

    return tempDiv.innerHTML;
  },

  /**
   * 后处理：在 HTML 插入到 DOM 后执行（Mermaid 需要真实 DOM）
   */
  postRender(container) {
    // Mermaid 图表
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      container.querySelectorAll('.language-mermaid').forEach((block) => {
        try {
          const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
          const div = document.createElement('div');
          div.className = 'mermaid';
          div.id = id;
          div.textContent = block.textContent;
          // 替换 pre>code 为 mermaid div
          const pre = block.closest('pre');
          if (pre) {
            pre.replaceWith(div);
          } else {
            block.replaceWith(div);
          }
          mermaid.run({ nodes: [div] });
        } catch (e) {
          // ignore mermaid errors
        }
      });
    }

    // 图片懒加载检测
    container.querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', () => {
        img.style.border = '1px dashed var(--border-color)';
        img.style.padding = '10px';
        img.alt = `[图片加载失败: ${img.alt || img.src}]`;
      });
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
