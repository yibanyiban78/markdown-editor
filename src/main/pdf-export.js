const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function exportPdfToFile({ htmlContent, filePath, BrowserWindow }) {
  const tempDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'markdown-editor-pdf-')
  );
  const htmlPath = path.join(tempDirectory, 'document.html');
  let printWindow;

  try {
    await fs.promises.writeFile(htmlPath, htmlContent, 'utf8');

    printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        javascript: false
      }
    });

    // A file URL keeps large documents and embedded fonts out of Chromium's
    // data-URL length limit while retaining the isolated print window.
    await printWindow.loadURL(pathToFileURL(htmlPath).href);
    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    });
    await fs.promises.writeFile(filePath, pdfData);
  } finally {
    if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
    await fs.promises.rm(tempDirectory, { recursive: true, force: true });
  }
}

module.exports = { exportPdfToFile };
