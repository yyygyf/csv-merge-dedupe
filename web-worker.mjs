import { parseCsv, compareCsv, compareReport } from './web-core.mjs';

function inspect(text, label) {
  const [header, ...rows] = parseCsv(text);
  if (!header?.length || header.some(h => !h.trim()) || new Set(header).size !== header.length)
    throw new Error(`${label}: invalid header`);
  if (header.length > 100) throw new Error(`${label}: exceeds 100 columns`);
  if (rows.length > 10000) throw new Error(`${label}: exceeds 10000 records`);
  rows.forEach((row, i) => {
    if (row.length !== header.length) throw new Error(`${label}: record ${i + 2} has wrong column count`);
  });
  return { header, count: rows.length };
}

self.onmessage = ({ data }) => {
  const { id, action, beforeText, afterText, keys } = data;
  try {
    if (typeof beforeText !== 'string' || typeof afterText !== 'string' ||
        beforeText.length > 1000000 || afterText.length > 1000000)
      throw new Error('Input exceeds browser limits');
    const before = inspect(beforeText, 'before'), after = inspect(afterText, 'after');
    if (before.header.length !== after.header.length || before.header.some(h => !after.header.includes(h)))
      throw new Error('Column names differ between snapshots');
    let value;
    if (action === 'inspect') value = { before, after };
    else if (action === 'compare') value = compareCsv(beforeText, afterText, keys);
    else if (action === 'report') value = compareReport(beforeText, afterText, keys).html;
    else throw new Error('Unknown operation');
    self.postMessage({ id, ok: true, value });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error.message });
  }
};
