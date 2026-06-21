const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function createUpdateManager() {
  const dom = new JSDOM('<!doctype html><html><body><button id="btn-update"></button></body></html>');
  const context = vm.createContext({
    document: dom.window.document,
    setTimeout: () => {},
    Editor: {
      showStatus: () => {}
    },
    window: {
      electronAPI: {
        onUpdateStatus: () => {},
        getUpdateStatus: () => Promise.resolve({ status: 'idle' }),
        checkForUpdates: () => Promise.resolve({ status: 'idle' }),
        downloadUpdate: () => Promise.resolve()
      }
    }
  });

  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'update.js'), 'utf8');
  vm.runInContext(`${source}\nthis.UpdateManager = UpdateManager;`, context);
  return { UpdateManager: context.UpdateManager, document: dom.window.document };
}

test('background update replay shows available update dialog when no dialog is open', () => {
  const { UpdateManager, document } = createUpdateManager();
  const state = {
    status: 'available',
    manual: false,
    updateInfo: {
      version: '1.1.2',
      releaseNotes: 'Test release'
    }
  };

  UpdateManager.handleStatus(state);
  assert.equal(document.querySelectorAll('.modal-overlay').length, 1);

  UpdateManager.closeDialog();
  UpdateManager.handleStatus(state, { replay: true });

  assert.equal(document.querySelectorAll('.modal-overlay').length, 1);
  assert.match(document.querySelector('.modal').textContent, /1\.1\.2/);
});
