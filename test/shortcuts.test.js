const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function createAppContext() {
  const dom = new JSDOM('<!doctype html><html><body><span id="status-text"></span><div id="single-preview"><p>单栏预览内容</p></div><textarea id="source-textarea">Markdown 源码</textarea><div id="preview-pane"><p>双模预览内容</p></div><input id="search-input"></body></html>', {
    runScripts: 'outside-only'
  });
  const deltas = [];
  const context = vm.createContext({
    document: dom.window.document,
    window: {
      innerWidth: 1200,
      innerHeight: 800,
      electronAPI: {
        getAppVersion: async () => '1.1.3'
      }
    },
    Editor: {
      init: () => {},
      newFile: () => {},
      openFile: () => {},
      requestClose: () => {},
      autoSaveEnabled: true,
      currentMode: 'single',
      currentDocumentId: null,
      isDirty: false,
      saveFile: () => {},
      changeFontSize: (delta) => deltas.push(delta)
    },
    SearchManager: {
      init: () => {},
      toggleSearch: () => {},
      hideSearch: () => {}
    },
    ExportManager: { init: () => {} },
    OutlineManager: {
      init: () => {},
      toggle: () => {}
    },
    UpdateManager: { init: () => {} },
    SettingsManager: { init: () => {} },
    setTimeout
  });

  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'app.js'), 'utf8');
  vm.runInContext(source, context);
  return { dom, deltas, context };
}

test('font size shortcuts call editor font controls', async () => {
  const { dom, deltas } = createAppContext();

  await new Promise((resolve) => setImmediate(resolve));

  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
    key: '=',
    ctrlKey: true,
    bubbles: true
  }));
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', {
    key: '-',
    ctrlKey: true,
    bubbles: true
  }));

  assert.deepEqual(deltas, [1, -1]);
});

test('Ctrl+A in preview mode selects only preview content', async () => {
  const { dom } = createAppContext();
  await new Promise((resolve) => setImmediate(resolve));

  const preview = dom.window.document.getElementById('single-preview');
  const event = new dom.window.KeyboardEvent('keydown', {
    key: 'a',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  });
  preview.dispatchEvent(event);

  const selection = dom.window.getSelection();
  assert.equal(event.defaultPrevented, true);
  assert.equal(selection.toString(), '单栏预览内容');
});

test('Ctrl+A on split preview selects only the preview pane', async () => {
  const { dom, context } = createAppContext();
  await new Promise((resolve) => setImmediate(resolve));

  context.Editor.currentMode = 'split';
  const preview = dom.window.document.getElementById('preview-pane');
  const event = new dom.window.KeyboardEvent('keydown', {
    key: 'a',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  });
  preview.dispatchEvent(event);

  const selection = dom.window.getSelection();
  assert.equal(event.defaultPrevented, true);
  assert.equal(selection.toString(), '双模预览内容');
});

test('Ctrl+A in split source textarea keeps the native textarea behavior', async () => {
  const { dom, context } = createAppContext();
  await new Promise((resolve) => setImmediate(resolve));

  context.Editor.currentMode = 'split';
  const textarea = dom.window.document.getElementById('source-textarea');
  const event = new dom.window.KeyboardEvent('keydown', {
    key: 'a',
    ctrlKey: true,
    bubbles: true,
    cancelable: true
  });
  textarea.dispatchEvent(event);

  assert.equal(event.defaultPrevented, false);
});
