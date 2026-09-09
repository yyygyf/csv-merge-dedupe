import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, mergeTables, encodeCsv } from './merge.mjs';

test('quoted commas, quotes, newlines and Chinese text round trip', () => {
  const rows = [['id', '说明'], ['001', '甲,乙\n"备注"'], ['002', '']];
  assert.deepEqual(parseCsv(encodeCsv(rows)), rows);
});
test('composite keys do not collide and first matching record wins', () => {
  const result = mergeTables([
    [['a','b','value'], ['x,y','z','first'], ['x','y,z','distinct']],
    [['a','b','value'], ['x,y','z','later']]
  ], ['a','b']);
  assert.equal(result.report.duplicates, 1);
  assert.equal(result.report.outputRows, 2);
  assert.equal(result.rows[1][2], 'first');
});
test('reject malformed records rather than silently dropping information', () => {
  for (const bad of ['a,"b', 'a,"b"c', 'a,b"c']) assert.throws(() => parseCsv(bad));
  assert.throws(() => mergeTables([[['id','v'], ['1']]], ['id']));
  assert.throws(() => mergeTables([[['id'], [' ']]], ['id']));
  assert.throws(() => mergeTables([[['id']], [['ID']]], ['id']));
  assert.throws(() => mergeTables([[['id','id']]], ['id']));
});
