const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vendorDirectory = path.join(root, 'src', 'vendor');
const fontsDirectory = path.join(vendorDirectory, 'fonts');

const files = [
  ['node_modules/@highlightjs/cdn-assets/highlight.min.js', 'highlight.min.js'],
  ['node_modules/@highlightjs/cdn-assets/styles/github.min.css', 'highlight-github.min.css'],
  ['node_modules/dompurify/dist/purify.min.js', 'purify.min.js'],
  ['node_modules/marked/lib/marked.umd.js', 'marked.umd.js'],
  ['node_modules/katex/dist/katex.min.js', 'katex.min.js'],
  ['node_modules/katex/dist/katex.min.css', 'katex.min.css'],
  ['node_modules/mermaid/dist/mermaid.min.js', 'mermaid.min.js'],
  ['node_modules/@highlightjs/cdn-assets/LICENSE', 'LICENSE-highlightjs.txt'],
  ['node_modules/dompurify/LICENSE', 'LICENSE-dompurify.txt'],
  ['node_modules/marked/LICENSE.md', 'LICENSE-marked.txt'],
  ['node_modules/katex/LICENSE', 'LICENSE-katex.txt']
];

fs.rmSync(vendorDirectory, { recursive: true, force: true });
fs.mkdirSync(fontsDirectory, { recursive: true });

for (const [source, destination] of files) {
  fs.copyFileSync(path.join(root, source), path.join(vendorDirectory, destination));
}

for (const font of fs.readdirSync(path.join(root, 'node_modules', 'katex', 'dist', 'fonts'))) {
  fs.copyFileSync(
    path.join(root, 'node_modules', 'katex', 'dist', 'fonts', font),
    path.join(fontsDirectory, font)
  );
}

console.log('Bundled frontend vendor assets into src/vendor.');
