const fs = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');

const formats = new Map([
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp']
]);

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function matchesHeader(type, header) {
  if (type === 'image/png') return header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (type === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
}

// Only the main process knows the document path. Serve an image, never a general-purpose file URL.
async function documentImageResponse(request, lookupDocument) {
  const notFound = () => new Response(null, { status: 404 });
  let handle;
  try {
    const url = new URL(request.url);
    const documentPath = lookupDocument(url.hostname);
    const src = url.searchParams.get('src');
    if (request.method !== 'GET' || !documentPath || !/\.(md|markdown)$/i.test(documentPath) || !src) return notFound();
    const name = decodeURIComponent(src.split(/[?#]/, 1)[0]).replace(/\\/g, '/');
    const type = formats.get(path.extname(name).toLowerCase());
    if (!type || name.startsWith('/') || /[:\x00-\x1f]/.test(name)) return notFound();

    const root = await fs.realpath(path.dirname(documentPath));
    const candidate = path.resolve(root, name);
    if (!isWithin(root, candidate)) return notFound();
    const target = await fs.realpath(candidate);
    if (!isWithin(root, target) || !(await fs.stat(target)).isFile()) return notFound();

    handle = await fs.open(target, 'r');
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || !matchesHeader(type, header)) return notFound();
    const stream = handle.createReadStream({ start: 0, autoClose: true });
    handle = null; // The stream now owns the handle, including on cancellation.
    return new Response(Readable.toWeb(stream), { headers: { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return notFound();
  } finally {
    if (handle) await handle.close();
  }
}

module.exports = { documentImageResponse };
