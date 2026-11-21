const { isUtf8 } = require('node:buffer');
const iconv = require('iconv-lite');

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function decoded(content, encoding) {
  const lineEnding = content.match(/\r\n|\r|\n/)?.[0] || '\n';
  return { content, textFormat: { encoding, lineEnding } };
}

async function decodeTextFile(bytes, chooseEncoding) {
  const hasBom = bytes.subarray(0, UTF8_BOM.length).equals(UTF8_BOM);
  const utf8 = isUtf8(bytes) ? bytes.toString('utf8', hasBom ? UTF8_BOM.length : 0) : null;
  if (hasBom) {
    if (utf8 === null) throw new Error('TXT 标有 UTF-8 BOM，但内容不是有效的 UTF-8。');
    return decoded(utf8, 'utf8-bom');
  }
  if (utf8 !== null && !/[^\x00-\x7f]/.test(utf8)) return decoded(utf8, 'utf8');

  const gbk = iconv.decode(bytes, 'gbk');
  if (gbk.includes('\ufffd')) {
    if (utf8 !== null) return decoded(utf8, 'utf8');
    throw new Error('无法按 UTF-8 或 GBK 读取这个 TXT 文件。');
  }
  if (utf8 === null) return decoded(gbk, 'gbk');

  // Some byte sequences are valid in both encodings and mean different words.
  const encoding = await chooseEncoding(utf8, gbk);
  if (!encoding) return null;
  return encoding === 'gbk' ? decoded(gbk, 'gbk') : decoded(utf8, 'utf8');
}

function textFormatForSave(format) {
  return {
    encoding: ['gbk', 'utf8-bom'].includes(format?.encoding) ? format.encoding : 'utf8',
    lineEnding: ['\r\n', '\r'].includes(format?.lineEnding) ? format.lineEnding : '\n'
  };
}

function encodeTextFile(content, format) {
  // Textareas normalize edited line endings to LF. Untouched content still has its originals.
  const text = format.lineEnding !== '\n' && !content.includes('\r')
    ? content.replace(/\n/g, format.lineEnding) : content;
  if (format.encoding === 'gbk') {
    const bytes = iconv.encode(text, 'gbk');
    if (iconv.decode(bytes, 'gbk') !== text) {
      const error = new Error('GBK 无法表示部分字符。按 Ctrl+S 可另存为 UTF-8 副本。');
      error.code = 'GBK_UNREPRESENTABLE';
      throw error;
    }
    return bytes;
  }
  const bytes = Buffer.from(text, 'utf8');
  return format.encoding === 'utf8-bom' ? Buffer.concat([UTF8_BOM, bytes]) : bytes;
}

module.exports = { decodeTextFile, encodeTextFile, textFormatForSave };
