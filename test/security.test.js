const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const markedPackage = require('marked');
const katex = require('katex');

function createRenderer() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'file:///app/src/index.html'
  });
  const context = vm.createContext({
    document: dom.window.document,
    NodeFilter: dom.window.NodeFilter,
    DOMPurify: createDOMPurify(dom.window),
    marked: markedPackage.marked,
    katex,
    crypto: webcrypto,
    navigator: { clipboard: { writeText: async () => {} } },
    setTimeout,
    console
  });
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'js', 'preview.js'),
    'utf8'
  );
  vm.runInContext(`${source}\nthis.renderer = MarkdownRenderer;`, context);
  return { renderer: context.renderer, document: dom.window.document };
}

test('Markdown HTML is sanitized before preview insertion', () => {
  const { renderer } = createRenderer();
  const html = renderer.render(`
<script>globalThis.compromised = true</script>
<iframe src="https://example.com"></iframe>
<img src="x" onerror="globalThis.compromised = true">

[bad](javascript:alert(1))
[good](https://example.com)
`);

  assert.doesNotMatch(html, /<script|<iframe|onerror|href="javascript:/i);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('Math rendering skips code spans and code blocks', () => {
  const { renderer, document } = createRenderer();
  const container = document.createElement('div');
  container.innerHTML = renderer.render('Inline $E=mc^2$ and code `$notMath$`.');

  assert.ok(container.querySelector('.katex'));
  assert.equal(container.querySelector('code').textContent, '$notMath$');
});

test('Preload bridge does not expose arbitrary path reads or writes', () => {
  const preload = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  assert.doesNotMatch(preload, /readFile|readDir|openFolder/);
  assert.doesNotMatch(preload, /filePath/);
  assert.match(preload, /fs:saveDocument/);
  assert.match(main, /documentId/);
});

test('Application HTML loads bundled scripts only', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+https?:\/\//i);
  assert.doesNotMatch(html, /script-src[^;"]*unsafe-inline/i);
  assert.match(html, /vendor\/purify\.min\.js/);
});
