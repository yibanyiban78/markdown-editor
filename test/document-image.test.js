const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { documentImageResponse } = require('../src/main/document-image');

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+S8AAAAASUVORK5CYII=', 'base64');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'md-images-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dir = path.join(root, 'docs');
  await fs.mkdir(path.join(dir, 'images'), { recursive: true });
  const doc = path.join(dir, 'readme.md');
  const request = (src, id = 'open') => documentImageResponse({
    method: 'GET', url: `md-image://${id}/?src=${encodeURIComponent(src)}`
  }, key => key === 'open' ? doc : null);
  return { root, dir, request };
}

test('relative image URLs preserve encoded filenames and safely normalize dot segments', async t => {
  const { dir, request } = await fixture(t);
  await fs.writeFile(path.join(dir, '图片 #1.PNG'), image);
  const response = await request('./images/../图片%20%231.PNG?version=2#image');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), image);
});

test('missing, untrusted, absolute, non-image and out-of-directory targets do not serve bytes', async t => {
  const { root, dir, request } = await fixture(t);
  await fs.writeFile(path.join(root, 'outside.png'), image);
  await fs.writeFile(path.join(dir, 'fake.jpg'), 'not an actual image');
  await fs.writeFile(path.join(dir, 'test.txt'), image);
  await fs.writeFile(path.join(dir, 'ok.png'), image);
  for (const src of ['../outside.png', '%2e%2e%2foutside.png', '..\\outside.png', 'C:/outside.png',
    'file:///outside.png', '//host/img.png', '/outside.png', 'fake.jpg', 'test.txt', 'missing.png', '%00.png', '%xx.png']) {
    assert.equal((await request(src)).status, 404, src);
  }
  assert.equal((await request('ok.png', 'unknown')).status, 404);
  await fs.symlink(root, path.join(dir, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal((await request('link/outside.png')).status, 404);
});
