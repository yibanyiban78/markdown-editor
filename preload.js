const { contextBridge, ipcRenderer, webUtils } = require('electron');

function subscribe(channel, callback) {
  if (typeof callback !== 'function') return () => {};
  const listener = (event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  droppedImageContext: (file) => {
    const location = webUtils.getPathForFile(file);
    return location ? ipcRenderer.invoke('document:droppedImageContext', location) : null;
  },
  decodeText: (bytes) => ipcRenderer.invoke('document:decodeText', bytes),
  saveFile: (data) => ipcRenderer.invoke('dialog:saveFile', data),
  saveDirect: (data) => ipcRenderer.invoke('fs:saveDocument', data),
  exportPDF: (htmlContent) => ipcRenderer.invoke('export:pdf', htmlContent),
  exportHTML: (htmlContent) => ipcRenderer.invoke('export:html', htmlContent),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getUpdateStatus: () => ipcRenderer.invoke('updates:getStatus'),
  checkForUpdates: (options) => ipcRenderer.invoke('updates:check', options),
  downloadUpdate: () => ipcRenderer.invoke('updates:download'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  confirmClose: () => ipcRenderer.send('app:confirmClose'),
  onOpenFileFromArg: (callback) => subscribe('app:openFileFromArg', callback),
  onRequestClose: (callback) => subscribe('app:requestClose', callback),
  onUpdateStatus: (callback) => subscribe('updates:status', callback)
});
