/** One-command sales/demo example: node demo.mjs demo-output
 * Creates a NEW folder containing synthetic inputs, outputs and acceptance notes.
 * No network, no customer data, no third-party dependencies. Node.js 22+.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { parseCsv, mergeTables, encodeCsv } from './merge.mjs';
import { auditCsv, renderReport } from './audit.mjs';
import { compareCsv } from './compare.mjs';

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node demo.mjs NEW-output-folder');
  const directory = resolve(process.argv[2]);
  const first = '订单号,客户,金额\n001,样例甲,100\n002,样例乙,200\n';
  const second = '订单号,客户,金额\n002,样例乙,200\n003,,bad\n';
  const later = '客户,金额,订单号\n样例甲,100,001\n样例乙,250,002\n样例丁,80,004\n';
  const merged = mergeTables([parseCsv(first),parseCsv(second)],['订单号']);
  const mergedCsv = encodeCsv(merged.rows);
  const audit = auditCsv(mergedCsv,{required:['客户','金额'],key:['订单号'],numbers:['金额']});
  const changes = compareCsv(mergedCsv,later,['订单号']);
  assert.equal(merged.report.inputRows,4);
  assert.equal(merged.report.outputRows,3);
  assert.equal(merged.report.duplicates,1);
  assert.equal(audit.affectedRows,1);
  assert.equal(audit.missing['客户'],1);
  assert.equal(audit.invalidNumbers['金额'],1);
  assert.deepEqual(changes.summary,{before:3,after:3,added:1,removed:1,changed:1,unchanged:1});
  const notes = '# 数据处理交付演示 / Data delivery demo\n\n所有记录为虚构样例，不是客户数据或已完成订单。工具由 Codex 辅助开发。\n\n## 验收结果\n\n1. 两个输入文件共 4 条记录，合并后 3 条，去除 1 条重复。\n2. audit.html：一条异常记录同时有客户缺失和金额格式错误。体检不会自动修正数据。\n3. changes.json：新增 004、删除 003、修改 002 的金额（200 → 250）、001 不变。\n4. later.csv 的列顺序不同，对比仍按列名工作。001 的前导零保持不变。\n\n## 输出文件\n\n- source-a.csv / source-b.csv：两份合并输入。\n- merged.csv / merge-summary.json：合并结果与统计。\n- audit.html：双击打开的中文体检报告。\n- later.csv：后一期快照。\n- changes.json：逐字段变更记录。\n\n## 复现命令（在仓库目录执行，替换路径）\n\n```sh\nnode demo.mjs another-new-folder\nnode --test merge.test.mjs audit.test.mjs\nnode compare.mjs --self-test\n```\n\n重复运行须换一个尚不存在的输出目录，工具不会覆盖原目录。运行中断时可能留下部分文件，应另选目录重跑。\n\n## 定制合作\n\n可按明确的字段映射、重复保留规则、校验条件及定期执行要求定制。小范围参考 199–499 元，具体范围、验收、期限和付款方式须先确认。\n需求入口：https://github.com/yyygyf/csv-merge-dedupe/issues/new?template=custom-work.md\n\nSynthetic demo only. The generated files show merge/deduplication, data-quality checks and snapshot comparison. Custom work is scoped and priced before implementation; no income or client history is implied.\n';
  const files = {'source-a.csv':first,'source-b.csv':second,'later.csv':later,
    'merged.csv':mergedCsv,'merge-summary.json':JSON.stringify(merged.report,null,2)+'\n',
    'audit.html':renderReport(audit),'changes.json':JSON.stringify(changes,null,2)+'\n','README.md':notes};
  await mkdir(directory); // Existing directories intentionally fail; never remove or overwrite them.
  for (const [name,content] of Object.entries(files)) await writeFile(join(directory,name),content,{flag:'wx'});
  console.log(JSON.stringify({directory,files:Object.keys(files),acceptance:'passed'},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
