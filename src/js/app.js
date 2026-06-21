document.addEventListener('DOMContentLoaded', async () => {
  await applyAppVersion();

  // Initialize all modules in order
  if (typeof Editor !== 'undefined') Editor.init();
  if (typeof SearchManager !== 'undefined') SearchManager.init();
  if (typeof ExportManager !== 'undefined') ExportManager.init();
  if (typeof OutlineManager !== 'undefined') OutlineManager.init();
  if (typeof UpdateManager !== 'undefined') UpdateManager.init();
  if (typeof SettingsManager !== 'undefined') SettingsManager.init();

  // 通过文件关联/命令行打开文件
  if (typeof window.electronAPI !== 'undefined' && window.electronAPI.onOpenFileFromArg) {
    window.electronAPI.onOpenFileFromArg(async (data) => {
      await Editor.openExternalDocument(data);
    });
  }

  if (typeof window.electronAPI !== 'undefined' && window.electronAPI.onRequestClose) {
    window.electronAPI.onRequestClose(() => {
      Editor.requestClose();
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      Editor.newFile();
    }
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (!Editor.autoSaveEnabled || !Editor.currentDocumentId || Editor.isDirty) {
        Editor.saveFile();
      }
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
      e.preventDefault();
      OutlineManager.toggle();
      return;
    }
    if (e.ctrlKey && e.key === 'o') {
      e.preventDefault();
      Editor.openFile();
      return;
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      SearchManager.toggleSearch();
      return;
    }
    const fontShortcut = getFontShortcutDelta(e);
    if (fontShortcut !== 0) {
      e.preventDefault();
      Editor.changeFontSize(fontShortcut);
      return;
    }
    if (e.key === 'Escape') {
      SearchManager.hideSearch();
    }
  });

  // Drag and drop file opening
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    document.body.classList.add('drag-over');
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    // 只在离开窗口时移除高亮
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      document.body.classList.remove('drag-over');
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.body.classList.add('drag-over');
  });

  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    document.body.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    await Editor.openDroppedFile(files[0]);
  });

  document.getElementById('status-text').textContent = '就绪';
});

async function applyAppVersion() {
  if (typeof window.electronAPI === 'undefined' || !window.electronAPI.getAppVersion) return;

  try {
    const version = await window.electronAPI.getAppVersion();
    if (!version) return;

    document.title = `极简Markdown编辑器 V${version}`;

    const versionLabel = document.querySelector('.welcome-version');
    if (versionLabel) versionLabel.textContent = `v${version}`;
  } catch {
    // Keep the static fallback title/version if the app version cannot be read.
  }
}

function getFontShortcutDelta(event) {
  if (!event.ctrlKey || event.altKey || event.metaKey) return 0;
  if (event.key === '=' || event.key === '+') return 1;
  if (event.key === '-') return -1;
  return 0;
}
