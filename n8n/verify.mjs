import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// This executes the JavaScript embedded in this trusted workflow file.
// Do not use this verifier on workflow files supplied by unknown parties.
const workflowText = readFileSync(new URL('./csv-snapshot-demo.json', import.meta.url), 'utf8');
const workflow = JSON.parse(workflowText);
const code = name => workflow.nodes.find(node => node.name === name).parameters.jsCode;
const execute = (name, items = []) => new Function('$input', code(name))({ all: () => items });
const compare = (beforeText, afterText, keys = ['id']) => execute('Compare snapshots', [{ json: { beforeText, afterText, keys } }])[0].json;
let passed = 0;
function check(name, body) { body(); passed++; console.log('PASS ' + name); }

check('synthetic sample: one of each change category and exact values', () => {
  const result = execute('Compare snapshots', execute('Synthetic snapshots'))[0].json;
  assert.deepEqual(result, {
    schemaVersion: '1.0', keys: ['订单号'],
    summary: { before: 3, after: 3, added: 1, removed: 1, changed: 1, unchanged: 1 },
    added: [{ '备注': '新增订单', '金额': '400', '客户': '示例丁', '订单号': '004' }],
    removed: [{ '订单号': '003', '客户': '示例丙', '金额': '300', '备注': '已取消' }],
    changed: [{ key: { '订单号': '002' }, fields: [{ column: '金额', before: '200', after: '250' }] }],
  });
});
check('BOM, CRLF, escaped quotes, commas, multiline fields, reordered headers', () => {
  const before = '\uFEFFid,note\r\n001,"a,""b""\r\nc"\r\n';
  const after = 'note,id\r\n"a,""b""\r\nc",001\r\n';
  assert.equal(compare(before, after).summary.unchanged, 1);
});
check('leading zeros, numeric spelling and whitespace remain significant', () => {
  const result = compare('id,v\n001,1.00\n1, x\n', 'id,v\n001,1\n1,x\n');
  assert.equal(result.summary.changed, 2);
  assert.deepEqual(result.changed.map(row => row.key.id), ['001', '1']);
});
check('composite keys do not collide when values contain delimiters', () => {
  const csv = 'id,part,v\n"a,b",c,1\na,"b,c",2\n';
  assert.equal(compare(csv, csv, ['id', 'part']).summary.unchanged, 2);
});
check('header-only snapshots and empty changed values', () => {
  assert.equal(compare('id,v\n', 'id,v\n').summary.before, 0);
  assert.deepEqual(compare('id,v\n1,x\n', 'id,v\n1,\n').changed[0].fields, [{ column: 'v', before: 'x', after: '' }]);
});
check('duplicate keys fail in either snapshot', () => {
  assert.throws(() => compare('id,v\n1,x\n1,y', 'id,v\n'), /before:.*duplicate key/);
  assert.throws(() => compare('id,v\n', 'id,v\n1,x\n1,y'), /after:.*duplicate key/);
});
check('blank keys, inconsistent columns and missing keys fail', () => {
  assert.throws(() => compare('id,v\n ,x', 'id,v\n'), /empty key/);
  assert.throws(() => compare('id,v\n1', 'id,v\n'), /wrong column count/);
  assert.throws(() => compare('other,v\n1,x', 'id,v\n'), /key column not found/);
  assert.throws(() => compare('id,v\n', 'id,other\n'), /Column names differ/);
});
check('malformed CSV quoting and invalid headers fail', () => {
  for (const csv of ['id,v\n1,"x', 'id,v\n1,x"y', 'id,v\n1,"x"z']) {
    assert.throws(() => compare(csv, 'id,v\n'), /quoted|quoting/);
  }
  for (const csv of ['', 'id,id\n', 'id, \n']) {
    assert.throws(() => compare(csv, 'id,v\n'), /invalid header/);
  }
});
check('input shape and decoded-text requirements fail clearly', () => {
  for (const keys of ['id', [], ['id', 'id'], [null], [' ']]) {
    assert.throws(() => compare('id,v\n', 'id,v\n', keys), /keys must/);
  }
  assert.throws(() => compare(null, 'id,v\n'), /CSV must be a string/);
  assert.throws(() => compare('id,v\u0000\n', 'id,v\n'), /NUL/);
  assert.throws(() => execute('Compare snapshots', []), /exactly one input item/);
  assert.throws(() => execute('Compare snapshots', [{ json: {} }, { json: {} }]), /exactly one input item/);
});
check('size limits reject oversized snapshots', () => {
  assert.throws(() => compare('a'.repeat(1000001), 'id,v\n'), /1000000/);
  const wide = ['id', ...Array.from({ length: 100 }, (_, i) => 'c' + i)].join(',');
  assert.throws(() => compare(wide, wide), /100 columns/);
  const long = 'id\n' + Array.from({ length: 10001 }, (_, i) => String(i)).join('\n');
  assert.throws(() => compare(long, 'id\n'), /10000 records/);
});
check('special object-property names remain ordinary data', () => {
  const csv = 'id,__proto__,constructor\n001,value,other\n';
  const result = compare('id,__proto__,constructor\n', csv);
  assert.equal(Object.hasOwn(result.added[0], '__proto__'), true);
  assert.equal(result.added[0].__proto__, 'value');
});

if (process.argv[2]) {
  check('actual n8n execution completed and returned the exact sample output', () => {
    const run = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    assert.equal(run.finished, true);
    assert.equal(run.status, 'success');
    assert.equal(run.data.resultData.error, undefined);
    for (const name of ['Manual Trigger', 'Synthetic snapshots', 'Compare snapshots']) {
      assert.equal(run.data.resultData.runData[name][0].executionStatus, 'success');
    }
    const actual = run.data.resultData.runData['Compare snapshots'][0].data.main[0];
    const expected = execute('Compare snapshots', execute('Synthetic snapshots'));
    assert.deepEqual(actual.map(item => item.json), expected.map(item => item.json));
  });
}
console.log(JSON.stringify({ passed, workflowSha256: createHash('sha256').update(workflowText).digest('hex'), n8nExecutionChecked: Boolean(process.argv[2]) }));
