const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

function createSettingsContext(savedSettings) {
  const dom = new JSDOM(`<!doctype html><html><body>
    <main id="main-container"></main>
    <button id="btn-settings"></button>
  </body></html>`, { url: 'https://markdown-editor.local/' });

  if (savedSettings) {
    dom.window.localStorage.setItem('editorSettings', JSON.stringify(savedSettings));
  }

  const context = vm.createContext({
    document: dom.window.document,
    localStorage: dom.window.localStorage
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'settings.js'), 'utf8');
  vm.runInContext(`${source}\nthis.SettingsManager = SettingsManager;`, context);
  return { dom, settings: context.SettingsManager };
}

test('outline panel defaults to the left', () => {
  const { dom, settings } = createSettingsContext();
  settings.init();

  assert.equal(settings.outlinePosition, 'left');
  assert.equal(dom.window.document.getElementById('main-container').classList.contains('outline-left'), true);
});

test('saved outline position still overrides the default', () => {
  const { dom, settings } = createSettingsContext({ outlinePosition: 'right' });
  settings.init();

  assert.equal(settings.outlinePosition, 'right');
  assert.equal(dom.window.document.getElementById('main-container').classList.contains('outline-left'), false);
});
