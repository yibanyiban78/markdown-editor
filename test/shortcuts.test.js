const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function createAppContext() {
  const dom = new JSDOM('<!doctype html><html><body><span id="status-text"></span></body></html>', {
    runScripts: 'outside-only'
  });
  const deltas = [];
  const context = vm.createContext({
    document: dom.window.document,
    window: {
      innerWidth: 1200,
      innerHeight: 800,
      electronAPI: {
        getAppVersion: async () => '1.1.2'
      }
    },
    Editor: {
      init: () => {},
      newFile: () => {},
      openFile: () => {},
      requestClose: () => {},
      autoSaveEnabled: true,
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
  return { dom, deltas };
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
