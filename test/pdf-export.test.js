const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { exportPdfToFile } = require('../src/main/pdf-export');

test('PDF export writes large HTML through a temporary file', async () => {
  const outputPath = path.join(os.tmpdir(), `markdown-editor-test-${process.pid}.pdf`);
  const largeHtml = `<!doctype html><body>${'large export content'.repeat(200_000)}</body>`;
  let loadedPath;
  let destroyed = false;

  class FakeBrowserWindow {
    constructor(options) {
      assert.equal(options.show, false);
      this.webContents = {
        printToPDF: async () => Buffer.from('%PDF-test')
      };
    }

    async loadURL(fileUrl) {
      loadedPath = new URL(fileUrl);
      assert.equal(await fs.promises.readFile(loadedPath, 'utf8'), largeHtml);
    }

    isDestroyed() {
      return destroyed;
    }

    destroy() {
      destroyed = true;
    }
  }

  try {
    await exportPdfToFile({
      htmlContent: largeHtml,
      filePath: outputPath,
      BrowserWindow: FakeBrowserWindow
    });

    assert.equal(await fs.promises.readFile(outputPath, 'utf8'), '%PDF-test');
    assert.equal(destroyed, true);
    await assert.rejects(fs.promises.access(loadedPath));
  } finally {
    await fs.promises.rm(outputPath, { force: true });
  }
});
