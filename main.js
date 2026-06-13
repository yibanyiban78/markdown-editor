const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentFilePath = null;
let pendingFilePath = null;

/** 从命令行参数中提取文件路径 */
function getFilePathFromArgv() {
  // process.argv: [exe路径, ...asar参数?, 文件路径]
  // 过滤掉 Electron 内部参数，取第一个看起来像文件路径的 .md 参数
  for (const arg of process.argv) {
    if (arg.endsWith('.md') || arg.endsWith('.markdown')) {
      if (fs.existsSync(arg)) return arg;
    }
  }
  return null;
}

function createWindow() {
  // 构建时：resources/ = app.asar + assets/ + preload.js
  const resourcesPath = process.resourcesPath;
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(resourcesPath, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(resourcesPath, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 移除默认菜单栏
  Menu.setApplicationMenu(null);

  // 页面加载完成后，处理命令行传入的文件
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFilePath) {
      try {
        const content = fs.readFileSync(pendingFilePath, 'utf-8');
        mainWindow.webContents.send('app:openFileFromArg', {
          filePath: pendingFilePath,
          fileName: path.basename(pendingFilePath),
          content
        });
      } catch (e) {
        console.error('无法打开文件:', e.message);
      }
      pendingFilePath = null;
    }
  });
}

app.whenReady().then(() => {
  // 请求单实例锁（确保文件关联打开时复用已有窗口）
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  // 检查命令行是否有待打开的文件
  pendingFilePath = getFilePathFromArgv();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Windows: 当已运行的实例再次被调用时（文件关联打开）
app.on('second-instance', (event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    // 检查 argv 中是否有文件路径
    for (const arg of argv) {
      if ((arg.endsWith('.md') || arg.endsWith('.markdown')) && fs.existsSync(arg)) {
        try {
          const content = fs.readFileSync(arg, 'utf-8');
          mainWindow.webContents.send('app:openFileFromArg', {
            filePath: arg,
            fileName: path.basename(arg),
            content
          });
        } catch (e) {}
        break;
      }
    }
  }
});

// IPC: Open file dialog
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  currentFilePath = filePath;
  return { filePath, content, fileName: path.basename(filePath) };
});

// IPC: Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return { folderPath: result.filePaths[0] };
});

// IPC: Read folder contents
ipcMain.handle('fs:readDir', async (event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      files.push({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
      });
    }
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    return files;
  } catch { return []; }
});

// IPC: Read file content
ipcMain.handle('fs:readFile', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, fileName: path.basename(filePath), filePath };
  } catch { return null; }
});

// IPC: Save file (with dialog if no path)
ipcMain.handle('dialog:saveFile', async (event, { content, filePath }) => {
  try {
    if (filePath) {
      fs.writeFileSync(filePath, content, 'utf-8');
      currentFilePath = filePath;
      return { success: true, filePath, fileName: path.basename(filePath) };
    }
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (result.canceled) return null;
    fs.writeFileSync(result.filePath, content, 'utf-8');
    currentFilePath = result.filePath;
    return { success: true, filePath: result.filePath, fileName: path.basename(result.filePath) };
  } catch { return { success: false }; }
});

// IPC: Save with existing path
ipcMain.handle('fs:saveFile', async (event, { content, filePath }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch { return { success: false }; }
});

// IPC: Export PDF
ipcMain.handle('export:pdf', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (result.canceled) return null;
    const pdfData = await mainWindow.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(result.filePath, pdfData);
    return { success: true, filePath: result.filePath };
  } catch { return { success: false }; }
});

// IPC: Export HTML
ipcMain.handle('export:html', async (event, htmlContent) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'HTML', extensions: ['html'] }]
    });
    if (result.canceled) return null;
    fs.writeFileSync(result.filePath, htmlContent, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch { return { success: false }; }
});
