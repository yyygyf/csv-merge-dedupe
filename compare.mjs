/**
 * CSV 快照对比：node compare.mjs 客户号 old.csv new.csv changes.json
 * 组合键：node compare.mjs 客户号,订单号 old.csv new.csv changes.json
 * 自检：node compare.mjs --self-test
 * Node.js 22+；使用同仓库 merge.mjs，无第三方依赖。Codex 辅助开发。
 * UTF-8/逗号 CSV，内存处理；列顺序可不同，列名集合须相同。
 * 键精确匹配，拒绝空键和重复键，不猜测如何配对；其他字段按原字符串比较。
 * JSON 包含原始数据，分享前脱敏。输入不变，输出不覆盖；退出 0 表示生成成功。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseCsv } from './merge.mjs';

export function compareCsv(beforeText, afterText, keys) {
  if (!keys?.length || new Set(keys).size !== keys.length) throw new Error('Specify unique key column names');
  function index(text, label) {
    const [header, ...rows] = parseCsv(text);
    if (!header?.length || header.some(h => !h.trim()) || new Set(header).size !== header.length)
      throw new Error(`${label}: invalid header`);
    const positions = keys.map(k => header.indexOf(k));
    if (positions.includes(-1)) throw new Error(`${label}: key column not found`);
    const map = new Map();
    for (const [i, row] of rows.entries()) {
      if (row.length !== header.length) throw new Error(`${label}: record ${i+2} has wrong column count`);
      const values = positions.map(p => row[p]);
      if (values.some(v => !v.trim())) throw new Error(`${label}: record ${i+2} has empty key`);
      const key = JSON.stringify(values);
      if (map.has(key)) throw new Error(`${label}: record ${i+2} has duplicate key`);
      map.set(key, Object.fromEntries(header.map((h,j) => [h,row[j]])));
    }
    return {header,map};
  }
  const before = index(beforeText,'before'), after = index(afterText,'after');
  if (before.header.length !== after.header.length || before.header.some(h => !after.header.includes(h)))
    throw new Error('Column names differ between snapshots');
  const added = [], removed = [], changed = [];
  let unchanged = 0;
  for (const [id, oldRow] of before.map) {
    if (!after.map.has(id)) { removed.push(oldRow); continue; }
    const newRow = after.map.get(id);
    const fields = before.header.filter(h => oldRow[h] !== newRow[h]);
    if (fields.length) changed.push({key:Object.fromEntries(keys.map(k=>[k,oldRow[k]])),
      fields:fields.map(column=>({column,before:oldRow[column],after:newRow[column]}))});
    else unchanged++;
  }
  for (const [id,row] of after.map) if (!before.map.has(id)) added.push(row);
  return {keys,summary:{before:before.map.size,after:after.map.size,added:added.length,
    removed:removed.length,changed:changed.length,unchanged},added,removed,changed};
}

async function selfTest() {
  const {default:assert} = await import('node:assert/strict');
  const r=compareCsv('id,name\n001,A\n002,B\n003,C\n','name,id\nA,001\nNew,002\nD,004\n',['id']);
  assert.deepEqual(r.summary,{before:3,after:3,added:1,removed:1,changed:1,unchanged:1});
  assert.deepEqual(r.changed[0].fields,[{column:'name',before:'B',after:'New'}]);
  assert.throws(()=>compareCsv('id\n1\n1\n','id\n1\n',['id']),/duplicate key/);
  assert.throws(()=>compareCsv('id,name\n,A\n','id,name\n1,A\n',['id']),/empty key/);
  assert.throws(()=>compareCsv('id,x\n1,a','id,y\n1,a',['id']),/Column names differ/);
  const c=compareCsv('a,b,value\nx|y,z,old\nx,y|z,same\n','b,value,a\nz,new,x|y\ny|z,same,x\n',['a','b']);
  assert.equal(c.summary.changed,1); assert.equal(c.summary.unchanged,1);
  const p=compareCsv('__proto__,v\n001,x\n','v,__proto__\ny,001\n',['__proto__']);
  assert.equal(p.changed[0].key.__proto__,'001');
  console.log('PASS: reordered columns; added/removed/changed; duplicate and empty key rejection; schema mismatch; composite key collision; special column names');
}
async function main() {
  const args=process.argv.slice(2);
  if (args.length===1 && args[0]==='--self-test') return selfTest();
  if (args.length!==4) throw new Error('Usage: node compare.mjs key[,key] before.csv after.csv changes.json | --self-test');
  const [key,before,after,output]=args;
  if ([before,after].some(p=>resolve(p)===resolve(output))) throw new Error('Output must differ from inputs');
  const decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
  const [a,b]=await Promise.all([readFile(before),readFile(after)]);
  const result=compareCsv(decode(a),decode(b),key.split(','));
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(result.summary));
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
