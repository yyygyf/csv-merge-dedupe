import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { parseCsv, encodeCsv } from './merge.mjs';

// Explicit encoding only: successful decoding cannot prove the chosen encoding.
const supported = new Set(['utf-8', 'gbk', 'gb18030', 'utf-16le', 'utf-16be']);
export function convertEncoding(bytes, encoding) {
  if (!supported.has(encoding)) throw new Error('Choose utf-8, gbk, gb18030, utf-16le or utf-16be');
  const has = (...prefix) => prefix.every((v, i) => bytes[i] === v);
  const bom = has(0xef, 0xbb, 0xbf) ? 'utf-8' : has(0xff, 0xfe) ? 'utf-16le' : has(0xfe, 0xff) ? 'utf-16be' : null;
  if (bom && bom !== encoding) throw new Error('Input BOM conflicts with the selected encoding');
  const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  if (text.includes('\0')) throw new Error('NUL character found; check the input format and encoding');
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('CSV header is missing');
  const header = rows[0];
  if (header.some(v => v.trim() === '') || new Set(header).size !== header.length)
    throw new Error('CSV headers must be nonempty and unique');
  rows.forEach((row, i) => {
    if (row.length !== header.length) throw new Error('Wrong field count at record ' + (i + 1));
  });
  return { csv: encodeCsv(rows), summary: { sourceEncoding: encoding, outputEncoding: 'utf-8', bom: true, columns: header.length, records: rows.length - 1 } };
}

function selfTest() {
  // GBK bytes D6 D0 CE C4 represent Chinese text; IDs remain strings.
  const gbk = Buffer.concat([Buffer.from('id,name\r\n001,'), Buffer.from([0xd6, 0xd0, 0xce, 0xc4]), Buffer.from('\r\n')]);
  for (const encoding of ['gbk', 'gb18030'])
    assert.deepEqual(parseCsv(convertEncoding(gbk, encoding).csv), [['id', 'name'], ['001', '\u4e2d\u6587']]);
  const sample = 'id,note\r\n001,"a,b\nsecond line"\r\n';
  const le = Buffer.from('\uFEFF' + sample, 'utf16le');
  assert.deepEqual(parseCsv(convertEncoding(le, 'utf-16le').csv), parseCsv(sample));
  assert.deepEqual(parseCsv(convertEncoding(Buffer.from(le).swap16(), 'utf-16be').csv), parseCsv(sample));
  assert.throws(() => convertEncoding(le, 'utf-8'), /BOM/);
  assert.throws(() => convertEncoding(Buffer.from([0x81]), 'gbk'));
  assert.throws(() => convertEncoding(Buffer.from('a,b\n1\n'), 'utf-8'), /field count/);
  assert.throws(() => convertEncoding(Buffer.from('a,a\n1,2\n'), 'utf-8'), /unique/);
  assert.throws(() => convertEncoding(Buffer.from('a\n\0\n'), 'utf-8'), /NUL/);
  assert.throws(() => convertEncoding(Buffer.from('a'), 'auto'), /Choose/);
  console.log('Encoding conversion self-test passed');
}

async function main(args) {
  if (args.length === 1 && args[0] === '--self-test') return selfTest();
  if (args.length !== 3) throw new Error('Usage: node convert-encoding.mjs encoding input.csv NEW-output.csv');
  const [encoding, input, output] = args;
  if (resolve(input) === resolve(output)) throw new Error('Output must not replace input');
  const result = convertEncoding(await readFile(input), encoding);
  await writeFile(output, result.csv, { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify(result.summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
