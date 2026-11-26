// Run with npm run test:images on a desktop. Use a separate Electron profile and real image decoders.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'md-preview-images-'));
  try {
    const result = spawnSync(require('electron'), [__filename, `--user-data-dir=${path.join(temp, 'profile')}`,
      `--image-fixtures=${temp}`], { stdio: 'inherit', timeout: 45000 });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
} else {
  const { app, dialog } = require('electron');
  const temp = app.commandLine.getSwitchValue('image-fixtures');
  app.once('browser-window-created', (_, win) => {
    win.webContents.once('did-finish-load', async () => {
      try {
        await verify(win.webContents, temp, dialog);
        app.exit(0);
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
  });
  require('../main');
}

async function verify(contents, temp, dialog) {
  const run = js => contents.executeJavaScript(js);
  const formats = ['jpeg', 'png', 'webp'];
  const names = ['cover.JPG', '图 集/截图 #1.png', '图 集/photo.webp'];
  const markdown = '![JPEG](./cover.JPG)\n\n![PNG](<图 集/截图%20%231.png>)\n\n![WebP](图%20集/photo.webp)';
  async function makeDocument(folder, width) {
    const root = path.join(temp, folder);
    fs.mkdirSync(path.join(root, '图 集'), { recursive: true });
    for (const [index, format] of formats.entries()) {
      const data = await run(`(() => {
        const canvas = document.createElement('canvas');
        canvas.width = ${width + index}; canvas.height = ${8 + index};
        const ctx = canvas.getContext('2d'); ctx.fillStyle = 'teal'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/${format}');
      })()`);
      assert.ok(data.startsWith(`data:image/${format};base64,`));
      fs.writeFileSync(path.join(root, names[index]), Buffer.from(data.split(',')[1], 'base64'));
    }
    const doc = path.join(root, '文档.md');
    fs.writeFileSync(doc, markdown);
    return doc;
  }
  async function check(mode, width) {
    const pane = mode === 'single' ? 'single-preview' : 'preview-pane';
    const sizes = await run(`(async () => {
      if (Editor.currentMode !== '${mode}') document.getElementById('btn-mode-${mode}').click();
      const images = [...document.querySelectorAll('#${pane} img')];
      return Promise.all(images.map(async image => {
        try { await image.decode(); } catch { throw Error('Image decode failed: ' + image.src); }
        return [image.naturalWidth, image.naturalHeight, image.getBoundingClientRect().width > 0];
      }));
    })()`);
    assert.deepEqual(sizes, formats.map((_, i) => [width + i, 8 + i, true]));
    console.log(`${mode}: ` + formats.map((format, i) => `${format} ${sizes[i][0]}x${sizes[i][1]}`).join(', '));
  }
  const first = await makeDocument('first', 20);
  const second = await makeDocument('second', 40);
  // Only the OS picker is stubbed. Use the actual main process, preload, CSP, editor and protocol.
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [first] });
  assert.ok(await run('Editor.openFile()'));
  await check('single', 20);
  await check('split', 20);

  // Deliver a real disk-backed File to the drop handler, not a synthetic in-memory File.
  await run(`document.body.insertAdjacentHTML('beforeend', '<input id="test-file" type="file" hidden>')`);
  const debug = contents.debugger;
  debug.attach();
  try {
    const { root } = await debug.sendCommand('DOM.getDocument');
    const { nodeId } = await debug.sendCommand('DOM.querySelector', { nodeId: root.nodeId, selector: '#test-file' });
    await debug.sendCommand('DOM.setFileInputFiles', { nodeId, files: [second] });
  } finally { debug.detach(); }
  assert.ok(await run(`Editor.openDroppedFile(document.getElementById('test-file').files[0])`));
  assert.equal(await run('Editor.currentDocumentId'), null);
  await check('split', 40);

  // First save in another directory must rebase the unchanged Markdown immediately.
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: path.join(path.dirname(first), 'saved.md') });
  assert.ok(await run('Editor.saveFile()'));
  await check('split', 20);
  assert.equal(fs.readFileSync(path.join(path.dirname(first), 'saved.md'), 'utf8'), markdown);

  assert.ok(await run('Editor.newFile()'));
  await run(`Editor._handleInput(${JSON.stringify(markdown)}); Editor.switchMode('single');`);
  assert.equal(await run("document.querySelectorAll('#single-preview img[src]').length"), 0);
  dialog.showSaveDialog = async () => ({ canceled: false, filePath: path.join(path.dirname(second), 'new.md') });
  assert.ok(await run('Editor.saveFile()'));
  await check('single', 40);
}
