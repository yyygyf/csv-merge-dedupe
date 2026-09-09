/**
 * 中文快照变更报告：node compare-report.mjs 订单号 before.csv after.csv report.html
 * Node.js 22+，同目录需 compare.mjs、merge.mjs。Codex 辅助开发。
 * 输出包含原始字段值，分享前脱敏；内存处理，不修改输入、不覆盖输出。
 * 支持浏览器打印。无外部资源或脚本，不验证业务规则或计算金额。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareCsv } from './compare.mjs';
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cell = value => '<td>'+escapeHtml(value)+'</td>';
function table(headers, rows) {
  if (!rows.length) return '<p>无记录。</p>';
  return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+escapeHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(cell).join('')+'</tr>').join('')+'</tbody></table></div>';
}
export function compareReport(beforeText, afterText, keys) {
  const result = compareCsv(beforeText, afterText, keys);
  const summaryNames = {before:'上期记录',after:'本期记录',added:'新增',removed:'删除',changed:'修改记录',unchanged:'未变'};
  const recordSection = (title, rows) => {
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return '<section><h2>'+title+'（'+rows.length+'）</h2>'+table(columns,rows.map(r=>columns.map(c=>r[c])))+'</section>';
  };
  const modified = result.changed.flatMap(r=>r.fields.map(f=>[...keys.map(k=>r.key[k]),f.column,f.before,f.after]));
  const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CSV 快照变更报告</title>'+
'<style>body{font:16px/1.65 system-ui,sans-serif;color:#172b42;background:#f4f7fa;margin:0}main{max-width:1100px;margin:32px auto;padding:32px;background:white}h1{margin-top:0}h2{margin-top:32px}.summary{display:flex;flex-wrap:wrap;gap:12px}.stat{background:#edf4fa;padding:12px 20px;border-radius:8px}.stat strong{display:block;font-size:28px}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ccd5df;padding:8px 12px;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#edf4fa}.table-wrap{overflow:auto}.note{color:#526479}@media print{body{background:white}main{margin:0;padding:0}.table-wrap{overflow:visible}thead{display:table-header-group}tr{break-inside:avoid}}</style>'+
'<main><h1>CSV 快照变更报告</h1><p class="note">按 '+keys.map(escapeHtml).join(' + ')+' 精确配对。相同记录的列顺序变化不计为修改。</p><div class="summary">'+Object.entries(result.summary).map(([k,v])=>'<div class="stat">'+summaryNames[k]+'<strong>'+v+'</strong></div>').join('')+'</div>'+
'<section><h2>修改明细（'+result.summary.changed+' 条记录，'+modified.length+' 个字段）</h2>'+table([...keys,'变更字段','修改前','修改后'],modified)+'</section>'+
recordSection('新增记录',result.added)+recordSection('删除记录',result.removed)+
'<p class="note">未变记录不逐条展示。本报告包含原始字段值，分享前请脱敏。空白单元格表示空字符串；数值按原文本比较，不计算金额或判断业务正确性。使用浏览器打印功能可保存为 PDF。</p></main></html>';
  return {html,summary:result.summary};
}
async function main() {
  const args=process.argv.slice(2);
  if(args.length===1 && args[0]==='--self-test') {
    const {default:assert}=await import('node:assert/strict');
    const r=compareReport('id,v\n01,old\n02,same\n03,gone','v,id\n<script>,01\nsame,02\nnew,04',['id']);
    assert.deepEqual(r.summary,{before:3,after:3,added:1,removed:1,changed:1,unchanged:1});
    assert.ok(r.html.includes('&lt;script&gt;')); assert.ok(!r.html.includes('<script>'));
    assert.ok(r.html.includes('修改前')); assert.ok(r.html.includes('gone'));
    assert.ok(compareReport('id\n','id\n',['id']).html.includes('无记录。'));
    assert.throws(()=>compareReport('id\n01\n01','id\n01',['id']),/duplicate key/);
    console.log('PASS: summary, field diff, added/removed, HTML escaping, empty input, duplicate rejection'); return;
  }
  if(args.length!==4) throw new Error('Usage: node compare-report.mjs key[,key] before.csv after.csv report.html | --self-test');
  const [key,before,after,output]=args;
  if([before,after].some(p=>resolve(p)===resolve(output))) throw new Error('Output must differ from inputs');
  const input=await Promise.all([readFile(before),readFile(after)]);
  const [a,b]=input.map(v=>new TextDecoder('utf-8',{fatal:true}).decode(v));
  const result=compareReport(a,b,key.split(','));
  await writeFile(output,result.html,{flag:'wx'}); console.log(JSON.stringify(result.summary));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
