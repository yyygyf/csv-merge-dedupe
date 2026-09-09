import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCsv } from './merge.mjs';

export function auditCsv(text, { required = [], key = [], numbers = [] } = {}) {
  const [header, ...rows] = parseCsv(text);
  if (!header?.length || header.some(h => !h.trim()) || new Set(header).size !== header.length)
    throw new Error('CSV requires nonempty, unique column names');
  for (const name of [...required, ...key, ...numbers])
    if (!header.includes(name)) throw new Error(`Unknown column: ${name}`);
  const missing = Object.fromEntries(required.map(n => [n, 0]));
  const invalidNumbers = Object.fromEntries(numbers.map(n => [n, 0]));
  const seen = new Set();
  let malformedRows = 0, duplicateKeys = 0, emptyKeys = 0, affectedRows = 0;
  const samples = [];
  for (const [index, row] of rows.entries()) {
    const problems = [];
    if (row.length !== header.length) { malformedRows++; problems.push('column count mismatch'); }
    else {
      for (const name of required) if (!row[header.indexOf(name)].trim()) {
        missing[name]++; problems.push(`missing: ${name}`);
      }
      for (const name of numbers) {
        const value = row[header.indexOf(name)].trim();
        if (value && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(Number(value)))) {
          invalidNumbers[name]++; problems.push(`invalid number: ${name}`);
        }
      }
      if (key.length) {
        const values = key.map(n => row[header.indexOf(n)]);
        if (values.some(v => !v.trim())) { emptyKeys++; problems.push('empty key'); }
        else {
          const id = JSON.stringify(values);
          if (seen.has(id)) { duplicateKeys++; problems.push('duplicate key'); }
          else seen.add(id);
        }
      }
    }
    if (problems.length) {
      affectedRows++;
      if (samples.length < 100) samples.push({ record: index + 2, problems });
    }
  }
  return { totalRows: rows.length, columns: header.length, affectedRows, malformedRows,
    duplicateKeys, emptyKeys, missing, invalidNumbers, samples,
    omittedSamples: affectedRows - samples.length };
}

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderReport(report) {
  const table = entries => `<table><tr><th>检查项</th><th>数量</th></tr>${entries.map(([k,v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join('')}</table>`;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CSV 数据体检报告</title><style>body{font:16px/1.6 system-ui;margin:40px auto;padding:0 24px;max-width:900px;color:#17283b;background:#f5f7fa}h1{font-size:32px}table{border-collapse:collapse;width:100%;background:white;margin:16px 0}td,th{text-align:left;padding:10px;border-bottom:1px solid #dde3eb}th{background:#e5edf5}.note{color:#526477}strong{color:#075e75}</style><h1>CSV 数据体检报告</h1><p>共 <strong>${report.totalRows}</strong> 条数据，${report.columns} 列；发现 <strong>${report.affectedRows}</strong> 条存在规则异常的记录。</p><p class="note">本报告仅检查指定规则，不代表数据完全正确。原始单元格内容不会出现在报告中；列名仍可能含敏感信息，分享前请检查。</p>${table([['字段数不一致',report.malformedRows],['重复键（首次之后）',report.duplicateKeys],['空键',report.emptyKeys],...Object.entries(report.missing).map(([k,v])=>['必填缺失：'+k,v]),...Object.entries(report.invalidNumbers).map(([k,v])=>['数字格式异常：'+k,v])])}<h2>异常位置（最多 100 条）</h2><p class="note">记录编号包含表头，从 2 开始；带换行的字段仍算一条记录。字段数不一致的记录跳过其他规则。空数字只由必填规则判定。</p><table><tr><th>记录</th><th>问题</th></tr>${report.samples.map(s=>`<tr><td>${s.record}</td><td>${s.problems.map(escapeHtml).join('<br>')}</td></tr>`).join('')}</table><p>另有 ${report.omittedSamples} 条异常记录未展示。</p></html>`;
}

async function main() {
  const [input, output, ...flags] = process.argv.slice(2);
  if (!input || !output || flags.length % 2) throw new Error('Usage: node audit.mjs input.csv report.html [--required a,b] [--key id] [--numbers amount]');
  if (resolve(input) === resolve(output)) throw new Error('Output must differ from input');
  const options = {}, names = {'--required':'required','--key':'key','--numbers':'numbers'};
  for (let i=0;i<flags.length;i+=2) {
    if (!names[flags[i]] || !flags[i+1] || options[names[flags[i]]]) throw new Error('Unknown, empty or repeated option');
    options[names[flags[i]]] = flags[i+1].split(',');
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(input));
  const report = auditCsv(text, options);
  await writeFile(output, renderReport(report), { flag: 'wx' });
  console.log(JSON.stringify({totalRows:report.totalRows,affectedRows:report.affectedRows,report:output}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
