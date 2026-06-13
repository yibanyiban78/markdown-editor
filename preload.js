const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readDir: (dirPath) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  saveDirect: (data) => ipcRenderer.invoke('fs:saveFile', data),
  exportPDF: () => ipcRenderer.invoke('export:pdf'),
  exportHTML: (htmlContent) => ipcRenderer.invoke('export:html', htmlContent),
  onOpenFileFromArg: (callback) => ipcRenderer.on('app:openFileFromArg', (event, data) => callback(data))
});
