import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], value = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else value += c;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(value); value = ''; closed = false;
      if (c !== ',') {
        rows.push(row); row = [];
        if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (c === '"' && value === '' && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error('Invalid CSV quoting');
      value += c;
    }
  }
  if (quoted) throw new Error('Unterminated quoted CSV field');
  if (row.length || value !== '' || closed) rows.push([...row, value]);
  return rows;
}

export function mergeTables(tables, keyNames) {
  if (!tables.length || !tables[0].length) throw new Error('No input header');
  const header = tables[0][0];
  if (header.some(h => !h) || new Set(header).size !== header.length)
    throw new Error('Headers must be nonempty and unique');
  const keys = keyNames.map(k => header.indexOf(k));
  if (!keys.length || keys.includes(-1)) throw new Error('Specify valid deduplication key columns');
  const seen = new Set(), output = [header];
  let inputRows = 0, duplicates = 0;
  tables.forEach((table, fileIndex) => {
    if (JSON.stringify(table[0]) !== JSON.stringify(header))
      throw new Error(`Header mismatch in input ${fileIndex + 1}`);
    table.slice(1).forEach((row, rowIndex) => {
      if (row.length !== header.length)
        throw new Error(`Wrong field count in input ${fileIndex + 1}, record ${rowIndex + 2}`);
      if (keys.some(k => row[k].trim() === ''))
        throw new Error(`Empty key in input ${fileIndex + 1}, record ${rowIndex + 2}`);
      inputRows++;
      const key = JSON.stringify(keys.map(k => row[k]));
      if (seen.has(key)) duplicates++;
      else { seen.add(key); output.push(row); }
    });
  });
  return { rows: output, report: { inputFiles: tables.length, inputRows, outputRows: output.length - 1, duplicates, keep: 'first', keys: keyNames } };
}

export function encodeCsv(rows) {
  return '\uFEFF' + rows.map(row => row.map(v => /[",\r\n]/.test(v)
    ? '"' + v.replaceAll('"', '""') + '"' : v).join(',')).join('\r\n') + '\r\n';
}

async function main(args) {
  const [key, destination, ...files] = args;
  if (!key || !destination || !files.length)
    throw new Error('Usage: node merge.mjs key1,key2 output.csv input1.csv input2.csv ...');
  const output = resolve(destination);
  if (files.some(f => resolve(f) === output)) throw new Error('Output must not replace an input');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const tables = await Promise.all(files.map(async file => parseCsv(decoder.decode(await readFile(file)))));
  const result = mergeTables(tables, key.split(','));
  // Exclusive create protects existing user files, including symlink targets.
  await writeFile(output, encodeCsv(result.rows), { flag: 'wx' });
  console.log(JSON.stringify(result.report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
