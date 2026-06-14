document.addEventListener('DOMContentLoaded', async () => {
  // Initialize all modules in order
  if (typeof Editor !== 'undefined') Editor.init();
  if (typeof SearchManager !== 'undefined') SearchManager.init();
  if (typeof ExportManager !== 'undefined') ExportManager.init();
  if (typeof OutlineManager !== 'undefined') OutlineManager.init();
  if (typeof SettingsManager !== 'undefined') SettingsManager.init();

  // 通过文件关联/命令行打开文件
  if (typeof window.electronAPI !== 'undefined' && window.electronAPI.onOpenFileFromArg) {
    window.electronAPI.onOpenFileFromArg((data) => {
      Editor.setContent(data.content, data.fileName, data.filePath);
      document.getElementById('status-text').textContent = `已打开: ${data.fileName}`;
      setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 2000);
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
      if (!Editor.autoSaveEnabled || !Editor.currentFilePath) {
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

    const file = files[0];
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
      // Electron 扩展了 File 对象，提供 file.path
      const filePath = file.path;
      if (filePath) {
        const result = await window.electronAPI.readFile(filePath);
        if (result) {
          Editor.setContent(result.content, result.fileName, result.filePath);
          document.getElementById('status-text').textContent = `已打开: ${result.fileName}`;
          setTimeout(() => { document.getElementById('status-text').textContent = '就绪'; }, 2000);
        }
      }
    }
  });

  document.getElementById('status-text').textContent = '就绪';
});
