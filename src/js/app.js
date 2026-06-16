document.addEventListener('DOMContentLoaded', async () => {
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
