import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCsv, renderReport } from './audit.mjs';

test('counts bad records once, preserves exact keys and skips malformed rows', () => {
  const result = auditCsv('id,name,amount\n001,A,2\n1,B,3\n001,,NaN\n,C,\nbroken\n', {required:['name','amount'],key:['id'],numbers:['amount']});
  assert.equal(result.totalRows,5);
  assert.equal(result.affectedRows,3);
  assert.equal(result.duplicateKeys,1);
  assert.equal(result.emptyKeys,1);
  assert.equal(result.malformedRows,1);
  assert.deepEqual(result.missing,{name:1,amount:1});
  assert.deepEqual(result.invalidNumbers,{amount:1});
});
test('report escapes user-controlled headers and omits raw cell values', () => {
  const report = auditCsv('id,<script>alert(1)</script>\nprivate-value,\n', {required:['<script>alert(1)</script>']});
  const html = renderReport(report);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('private-value'));
});
test('invalid schema fails and long reports cap samples without losing counts', () => {
  assert.throws(()=>auditCsv('id,id\n1,2'));
  assert.throws(()=>auditCsv('id\n1', {required:['missing']}));
  const report=auditCsv('id,name\n'+'1,\n'.repeat(105),{required:['name']});
  assert.equal(report.affectedRows,105);
  assert.equal(report.samples.length,100);
  assert.equal(report.omittedSamples,5);
});
