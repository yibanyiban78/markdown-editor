const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const { JSDOM } = require('jsdom');
const { decodeTextFile, encodeTextFile, textFormatForSave } = require('../src/main/text-file');

test('GBK Chinese, including a GBK-only character, keeps the original bytes and edited CRLFs', async () => {
  const bytes = Buffer.from('d6d0cec40d0a81400d0a', 'hex');
  const { content, textFormat } = await decodeTextFile(bytes, assert.fail);
  assert.equal(content, '中文\r\n丂\r\n');
  assert.equal(textFormat.encoding, 'gbk');
  assert.deepEqual(encodeTextFile(content, textFormat), bytes);
  assert.deepEqual(encodeTextFile('中文\n测试\n', textFormat), Buffer.from('d6d0cec40d0ab2e2cad40d0a', 'hex'));
  assert.throws(() => encodeTextFile('中文🙂', textFormat), { code: 'GBK_UNREPRESENTABLE' });
});

test('new TXT uses UTF-8, and an existing UTF-8 BOM survives a save without entering the editor', async () => {
  assert.deepEqual(encodeTextFile('中文', textFormatForSave()), Buffer.from('e4b8ade69687', 'hex'));
  const bytes = Buffer.from('efbbbfe4b8ade696870a', 'hex');
  const { content, textFormat } = await decodeTextFile(bytes, assert.fail);
  assert.equal(content, '中文\n');
  assert.deepEqual(encodeTextFile(content, textFormat), bytes);
  for (const text of ['', 'ASCII', '会议。']) {
    const plain = await decodeTextFile(Buffer.from(text), () => 'utf8');
    assert.equal(plain.content, text);
    assert.equal(plain.textFormat.encoding, 'utf8');
  }
});

test('ambiguous bytes can open in either encoding or be canceled; malformed text is rejected', async () => {
  const bytes = Buffer.from('c2b3', 'hex'); // GBK 鲁, UTF-8 ³
  for (const [encoding, expected] of [['gbk', '鲁'], ['utf8', '³']]) {
    const result = await decodeTextFile(bytes, (utf8, gbk) => {
      assert.deepEqual([utf8, gbk], ['³', '鲁']);
      return encoding;
    });
    assert.equal(result.content, expected);
    assert.deepEqual(encodeTextFile(result.content, result.textFormat), bytes);
  }
  assert.equal(await decodeTextFile(bytes, () => null), null);
  await assert.rejects(decodeTextFile(Buffer.from([0x81]), assert.fail), /UTF-8 或 GBK/);
});

// Use the production IPC handlers and filesystem; only the native window and dialogs are stand-ins.
async function documentCommands(dialog) {
  const handlers = new Map();
  const contents = Object.assign(new EventEmitter(), {
    setWindowOpenHandler() {}, session: Object.assign(new EventEmitter(), { setPermissionRequestHandler() {} })
  });
  const electron = {
    app: Object.assign(new EventEmitter(), {
      getVersion: () => 'test', requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve()
    }),
    BrowserWindow: class extends EventEmitter {
      webContents = contents;
      isDestroyed() { return false; }
      maximize() {}
      loadFile() {}
    },
    Menu: { setApplicationMenu() {} }, protocol: { handle() {} }, dialog,
    ipcMain: { handle: (name, handler) => handlers.set(name, handler), on() {} }
  };
  const entry = path.join(__dirname, '..', 'main.js');
  const appRequire = createRequire(entry);
  vm.runInNewContext(fs.readFileSync(entry, 'utf8'), {
    __dirname: path.dirname(entry), process, Buffer, Uint8Array,
    require(id) {
      if (id === 'electron') return electron;
      if (id === 'electron-updater') return {};
      return appRequire(id);
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  return (channel, data) => handlers.get(channel)({ sender: contents }, data);
}

test('manual save and auto-save both write GBK to disk; an incompatible edit can only save to a copy', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-gbk-'));
  const original = path.join(dir, '原件.TXT');
  const copy = path.join(dir, '副本.txt');
  t.after(() => {
    for (const file of [original, copy]) fs.rmSync(file, { force: true });
    fs.rmdirSync(dir);
  });
  fs.writeFileSync(original, Buffer.from('d6d0cec4', 'hex'));
  let savePath;
  const invoke = await documentCommands({
    showOpenDialog: async () => ({ filePaths: [original] }),
    showSaveDialog: async () => ({ canceled: !savePath, filePath: savePath })
  });
  const opened = await invoke('dialog:openFile');
  assert.equal(opened.content, '中文');
  const save = (channel, content) => invoke(channel, { documentId: opened.documentId, content });
  assert.ok((await save('dialog:saveFile', '测试')).success);
  assert.equal(fs.readFileSync(original).toString('hex'), 'b2e2cad4');
  assert.ok((await save('fs:saveDocument', '中文测试')).success);
  const expected = Buffer.from('d6d0cec4b2e2cad4', 'hex');
  assert.deepEqual(fs.readFileSync(original), expected);
  assert.equal((await save('fs:saveDocument', '中文🙂')).code, 'GBK_UNREPRESENTABLE');
  assert.equal(await save('dialog:saveFile', '中文🙂'), null);
  savePath = original;
  assert.equal((await save('dialog:saveFile', '中文🙂')).success, false);
  savePath = copy;
  assert.ok((await save('dialog:saveFile', '中文🙂')).success);
  assert.deepEqual(fs.readFileSync(original), expected);
  assert.equal(fs.readFileSync(copy, 'utf8'), '\ufeff中文🙂');
});

test('TXT opens for editing, preserves literal text in both previews and export, then restores Markdown', async (t) => {
  const src = path.join(__dirname, '..', 'src');
  const dom = new JSDOM(fs.readFileSync(path.join(src, 'index.html'), 'utf8'), {
    runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const ctx = dom.getInternalVMContext();
  const document = dom.window.document;
  dom.window.DOMPurify = require('dompurify')(dom.window);
  dom.window.marked = require('marked').marked;
  for (const name of ['preview', 'editor', 'outline', 'export']) {
    vm.runInContext(fs.readFileSync(path.join(src, 'js', name + '.js'), 'utf8'), ctx);
  }
  const editor = vm.runInContext('Editor', ctx);
  const content = '\n# 标题\n\n  **文字**\t<b>字面内容</b>  \n';
  dom.window.electronAPI = {
    decodeText: bytes => decodeTextFile(Buffer.from(bytes), () => 'utf8'),
    saveFile: async () => ({ success: true, fileName: '新建.txt', documentId: 'new', textFormat: textFormatForSave() })
  };
  await editor.openDroppedFile(new File([content], '会议.TXT'));
  assert.equal(editor.currentMode, 'source');
  assert.equal(editor.currentDocumentId, null);
  assert.equal(document.activeElement.id, 'source-full');
  for (const [mode, id] of [['single', 'single-preview'], ['split', 'preview-pane']]) {
    editor.switchMode(mode);
    const pane = document.getElementById(id);
    assert.equal(pane.textContent, content);
    assert.equal(pane.children.length, 0);
    assert.ok(pane.classList.contains('plain-text'));
  }
  assert.equal(document.querySelectorAll('.outline-item').length, 0);
  const html = await vm.runInContext('ExportManager.buildExportDocument()', ctx);
  const exported = new dom.window.DOMParser().parseFromString(html, 'text/html').querySelector('main');
  assert.equal(exported.textContent, content);
  assert.equal(exported.children.length, 0);

  await editor.openExternalDocument({ fileName: '会议.md', content: '# 标题' });
  assert.equal(editor.currentMode, 'single');
  assert.equal(document.querySelector('#single-preview h1').textContent, '标题');
  assert.equal(document.getElementById('file-encoding').hidden, true);

  await editor.newFile();
  editor._handleInput('# 新建文档');
  await editor.saveFile();
  assert.equal(editor.isPlainText, true);
  assert.equal(document.getElementById('single-preview').textContent, '# 新建文档');
});
