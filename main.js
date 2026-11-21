const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { exportPdfToFile } = require('./src/main/pdf-export');
const { decodeTextFile, encodeTextFile, textFormatForSave } = require('./src/main/text-file');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {
  autoUpdater = null;
}

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MARKDOWN_FILTER = { name: 'Markdown 文档', extensions: ['md', 'markdown'] };
const TXT_FILTER = { name: '纯文本文件', extensions: ['txt'] };
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const documents = new Map();
const pendingWrites = new Map();

let mainWindow;
let pendingFilePath = null;
let allowWindowClose = false;
let updateCheckTimer = null;
let updateState = {
  status: 'idle',
  manual: false,
  version: app.getVersion(),
  updateInfo: null,
  error: null,
  progress: null,
  lastCheckedAt: null
};

function isDocumentPath(filePath) {
  const extension = path.extname(filePath || '').toLowerCase();
  return extension === '.md' || extension === '.markdown' || extension === '.txt';
}

function getFilePathFromArgv(argv = process.argv) {
  for (const arg of argv) {
    if (typeof arg === 'string' && isDocumentPath(arg) && fs.existsSync(arg)) {
      return path.resolve(arg);
    }
  }
  return null;
}

function isTextFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.txt';
}

async function chooseTextEncoding(utf8, gbk) {
  // Show the portion that differs even when the file starts with a long ASCII header.
  const start = Math.max(0, utf8.search(/[^\x00-\x7f]/) - 12);
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'TXT 文件编码',
    message: '这个文件可用两种编码读取。请选择文字显示正确的一项。',
    detail: 'UTF-8　' + utf8.slice(start, start + 100) + '\n\nGBK　' + gbk.slice(start, start + 100),
    buttons: ['UTF-8', 'GBK', '取消'],
    defaultId: 0,
    cancelId: 2
  });
  return ['utf8', 'gbk'][result.response];
}

async function readDocument(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!isDocumentPath(resolvedPath)) {
    throw new Error('Unsupported file type');
  }

  const stats = await fs.promises.stat(resolvedPath);
  if (!stats.isFile() || stats.size > MAX_DOCUMENT_BYTES) {
    throw new Error('File is too large or is not a regular file');
  }

  const bytes = await fs.promises.readFile(resolvedPath);
  const data = isTextFile(resolvedPath)
    ? await decodeTextFile(bytes, chooseTextEncoding)
    : { content: bytes.toString('utf8') };
  if (!data) return null;

  const documentId = crypto.randomUUID();
  documents.set(documentId, { filePath: resolvedPath, textFormat: data.textFormat });
  return { ...data, documentId, fileName: path.basename(resolvedPath) };
}

async function sendFileToRenderer(filePath) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    const documentData = await readDocument(filePath);
    if (documentData) mainWindow.webContents.send('app:openFileFromArg', documentData);
  } catch (error) {
    dialog.showErrorBox('无法打开文件', error.message);
  }
}

function isTrustedSender(event) {
  return mainWindow &&
    !mainWindow.isDestroyed() &&
    event.sender === mainWindow.webContents;
}

async function writeDocument({ filePath, textFormat }, content) {
  const bytes = textFormat ? encodeTextFile(content, textFormat) : Buffer.from(content, 'utf8');
  // A manual save and an auto-save can reach the same file while a write is still pending.
  const previous = pendingWrites.get(filePath) || Promise.resolve();
  const writing = previous.catch(() => {}).then(() => fs.promises.writeFile(filePath, bytes));
  pendingWrites.set(filePath, writing);
  try {
    await writing;
  } finally {
    if (pendingWrites.get(filePath) === writing) pendingWrites.delete(filePath);
  }
}

function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ||
      parsed.protocol === 'http:' ||
      parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}

function configureNavigationSecurity(window) {
  const appPageUrl = pathToFileURL(path.join(__dirname, 'src', 'index.html')).href;

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (url === appPageUrl || url.startsWith(`${appPageUrl}#`)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
  });

  window.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(false);
  });

  window.webContents.session.on('will-download', (event) => {
    event.preventDefault();
  });
}

function getSafeUpdateInfo(info) {
  if (!info) return null;
  return {
    version: info.version || '',
    releaseDate: info.releaseDate || '',
    releaseName: info.releaseName || '',
    releaseNotes: info.releaseNotes || ''
  };
}

function getUpdateState() {
  return {
    status: updateState.status,
    manual: updateState.manual,
    version: updateState.version,
    updateInfo: updateState.updateInfo,
    error: updateState.error,
    progress: updateState.progress,
    lastCheckedAt: updateState.lastCheckedAt
  };
}

function isPortableBuild() {
  return Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
}

function setUpdateState(partial) {
  updateState = { ...updateState, ...partial };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:status', getUpdateState());
  }
}

function bringWindowToFrontForUpdate() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function configureAutoUpdates() {
  if (!autoUpdater) {
    setUpdateState({ status: 'unavailable', error: 'Updater module is not installed' });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      error: null,
      progress: null,
      lastCheckedAt: new Date().toISOString()
    });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateState({
      status: 'available',
      updateInfo: getSafeUpdateInfo(info),
      error: null,
      progress: null
    });
    if (!updateState.manual) bringWindowToFrontForUpdate();
  });

  autoUpdater.on('update-not-available', (info) => {
    setUpdateState({
      status: 'not-available',
      updateInfo: getSafeUpdateInfo(info),
      error: null,
      progress: null
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      error: null,
      progress: {
        percent: Math.round(progress.percent || 0),
        bytesPerSecond: progress.bytesPerSecond || 0,
        transferred: progress.transferred || 0,
        total: progress.total || 0
      }
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({
      status: 'downloaded',
      updateInfo: getSafeUpdateInfo(info),
      error: null,
      progress: null
    });
  });

  autoUpdater.on('error', (error) => {
    setUpdateState({
      status: 'error',
      error: error.message || 'Update check failed',
      progress: null
    });
  });
}

async function checkForUpdates(manual = false) {
  if (!app.isPackaged || isPortableBuild()) {
    setUpdateState({
      status: 'disabled',
      manual,
      error: null,
      progress: null,
      lastCheckedAt: new Date().toISOString()
    });
    return getUpdateState();
  }

  if (!autoUpdater) {
    setUpdateState({ status: 'unavailable', manual, error: 'Updater module is not installed' });
    return getUpdateState();
  }

  if (updateState.status === 'checking' || updateState.status === 'downloading') {
    return getUpdateState();
  }

  setUpdateState({ manual, error: null });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    setUpdateState({
      status: 'error',
      error: error.message || 'Update check failed',
      progress: null
    });
  }
  return getUpdateState();
}

function scheduleAutoUpdateChecks() {
  if (!app.isPackaged || updateCheckTimer) return;
  setTimeout(() => checkForUpdates(false), 10000);
  updateCheckTimer = setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
}

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  Menu.setApplicationMenu(null);
  configureNavigationSecurity(mainWindow);

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFilePath) {
      const filePath = pendingFilePath;
      pendingFilePath = null;
      sendFileToRenderer(filePath);
    }
  });

  mainWindow.on('close', (event) => {
    if (allowWindowClose) return;
    event.preventDefault();
    mainWindow.webContents.send('app:requestClose');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    documents.clear();
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    const filePath = getFilePathFromArgv(argv);
    if (filePath) sendFileToRenderer(filePath);
  });

  app.whenReady().then(() => {
    pendingFilePath = getFilePathFromArgv();
    configureAutoUpdates();
    createWindow();
    scheduleAutoUpdateChecks();
  });
}

app.on('window-all-closed', () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    allowWindowClose = false;
    createWindow();
  }
});

ipcMain.handle('dialog:openFile', async (event) => {
  if (!isTrustedSender(event)) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown 和纯文本文件', extensions: ['md', 'markdown', 'txt'] },
      MARKDOWN_FILTER, TXT_FILTER
    ]
  });
  if (result.canceled || result.filePaths.length === 0) return null;

  try {
    return await readDocument(result.filePaths[0]);
  } catch (error) {
    dialog.showErrorBox('无法打开文件', error.message);
    return null;
  }
});

ipcMain.handle('document:decodeText', async (event, bytes) => {
  if (!isTrustedSender(event) || !(bytes instanceof Uint8Array) || bytes.byteLength > MAX_DOCUMENT_BYTES) {
    return null;
  }
  try {
    return await decodeTextFile(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), chooseTextEncoding);
  } catch (error) {
    dialog.showErrorBox('无法打开 TXT 文件', error.message);
    return null;
  }
});

async function chooseSaveTarget(name, format, title, filters) {
  const result = await dialog.showSaveDialog(mainWindow, { title, defaultPath: name, filters });
  if (result.canceled || !result.filePath) return null;
  const filePath = path.extname(result.filePath) ? result.filePath : result.filePath + '.' + filters[0].extensions[0];
  return { filePath, textFormat: isTextFile(filePath) ? textFormatForSave(format) : null };
}

ipcMain.handle('dialog:saveFile', async (event, data) => {
  if (!isTrustedSender(event) || !data || typeof data.content !== 'string') {
    return { success: false };
  }

  try {
    let documentId = data.documentId;
    let target = documents.get(documentId);
    if (!target) {
      const name = path.basename(data.fileName || '未命名');
      const filters = isTextFile(name) ? [TXT_FILTER, MARKDOWN_FILTER] : [MARKDOWN_FILTER, TXT_FILTER];
      target = await chooseSaveTarget(name, data.textFormat, '保存文档', filters);
      if (!target) return null;
      documentId = crypto.randomUUID();
    }

    try {
      await writeDocument(target, data.content);
    } catch (error) {
      if (error.code !== 'GBK_UNREPRESENTABLE') throw error;
      const original = target.filePath;
      const { dir, name } = path.parse(original);
      target = await chooseSaveTarget(path.join(dir, name + '-UTF8.txt'),
        { ...target.textFormat, encoding: 'utf8-bom' }, '部分字符超出 GBK，另存为 UTF-8 副本', [TXT_FILTER]);
      if (!target) return null;
      if (!path.relative(original, target.filePath)) {
        throw new Error('请为 UTF-8 副本选择不同的文件名，以保留原 GBK 文件。');
      }
      await writeDocument(target, data.content);
      documentId = crypto.randomUUID();
    }
    documents.set(documentId, target);
    return {
      success: true,
      documentId,
      fileName: path.basename(target.filePath),
      textFormat: target.textFormat
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('fs:saveDocument', async (event, data) => {
  if (!isTrustedSender(event) || !data || typeof data.content !== 'string') {
    return { success: false };
  }

  const target = documents.get(data.documentId);
  if (!target) return { success: false, error: 'Document is not authorized' };

  try {
    await writeDocument(target, data.content);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message, code: error.code };
  }
});

ipcMain.handle('export:html', async (event, htmlContent) => {
  if (!isTrustedSender(event) || typeof htmlContent !== 'string') {
    return { success: false };
  }

  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'HTML', extensions: ['html'] }]
    });
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(result.filePath, htmlContent, 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export:pdf', async (event, htmlContent) => {
  if (!isTrustedSender(event) || typeof htmlContent !== 'string') {
    return { success: false };
  }

  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled || !result.filePath) return null;

    await exportPdfToFile({
      htmlContent,
      filePath: result.filePath,
      BrowserWindow
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('updates:getStatus', (event) => {
  if (!isTrustedSender(event)) return getUpdateState();
  return getUpdateState();
});

ipcMain.handle('app:getVersion', (event) => {
  if (!isTrustedSender(event)) return app.getVersion();
  return app.getVersion();
});

ipcMain.handle('updates:check', async (event, options = {}) => {
  if (!isTrustedSender(event)) return getUpdateState();
  return checkForUpdates(Boolean(options.manual));
});

ipcMain.handle('updates:download', async (event) => {
  if (!isTrustedSender(event) || !autoUpdater || !app.isPackaged) return getUpdateState();
  if (updateState.status !== 'available') return getUpdateState();

  try {
    setUpdateState({ status: 'downloading', error: null, progress: { percent: 0 } });
    await autoUpdater.downloadUpdate();
  } catch (error) {
    setUpdateState({
      status: 'error',
      error: error.message || 'Update download failed',
      progress: null
    });
  }
  return getUpdateState();
});

ipcMain.handle('updates:install', (event) => {
  if (!isTrustedSender(event) || !autoUpdater || updateState.status !== 'downloaded') {
    return { success: false };
  }

  allowWindowClose = true;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { success: true };
});

ipcMain.on('app:confirmClose', (event) => {
  if (!isTrustedSender(event) || !mainWindow) return;
  allowWindowClose = true;
  mainWindow.close();
});
