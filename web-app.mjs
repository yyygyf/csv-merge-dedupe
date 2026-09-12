const $ = id => document.getElementById(id);
const slots = Object.fromEntries(['before', 'after'].map(name => [name, {
  file: null, text: null, loadId: 0, loading: false, sample: false, error: null,
}]));
let revision = 0, operation = 0, pending = null, schema = null, result = null;
let view = 'changed', page = 0, detailRows = [];
const pageSize = 50;
const selectedKeys = () => [...$('key-list').querySelectorAll('input:checked')].map(el => el.value);
const element = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};

function notice(text, error = false) {
  $('notice').textContent = text;
  $('notice').classList.toggle('error', error);
}
function explain(error) {
  return error.message
    .replace('before:', '上期：').replace('after:', '本期：')
    .replace(/record (\d+) has duplicate key/, '第 $1 条记录编号重复（表头计为第 1 条）')
    .replace(/record (\d+) has empty key/, '第 $1 条记录编号为空（表头计为第 1 条）')
    .replace(/record (\d+) has wrong column count/, '第 $1 条记录的字段数量与表头不同')
    .replace('invalid header', '表头为空，或含空白 / 重复列名')
    .replace('Column names differ between snapshots', '两份文件的列名不一致，请检查缺少或多出的列')
    .replace('Invalid CSV quoting', 'CSV 引号格式不正确')
    .replace('Unterminated quoted CSV field', 'CSV 字段的引号未闭合')
    .replace('exceeds 100 columns', '超过 100 列演示上限')
    .replace('exceeds 10000 records', '超过 10,000 条记录演示上限');
}
function refresh() {
  const reading = Object.values(slots).some(slot => slot.loading);
  const busy = !!pending || reading;
  $('compare').disabled = busy || !schema || !selectedKeys().length;
  $('key-options').disabled = busy || !schema;
  $('cancel').hidden = !busy;
  $('download-json').disabled = busy || !result;
  $('download-html').disabled = busy || !result;
  $('workspace').setAttribute('aria-busy', String(busy));
}
function stopWorker() {
  if (!pending) return;
  const old = pending;
  pending = null;
  old.finish(new DOMException('Cancelled', 'AbortError'));
}
function invalidate(keepSchema = false) {
  revision++;
  stopWorker();
  result = null;
  detailRows = [];
  $('results').hidden = true;
  $('stats').replaceChildren();
  $('table-container').replaceChildren();
  if (!keepSchema) {
    schema = null;
    $('key-list').replaceChildren();
    $('key-placeholder').hidden = false;
  }
  refresh();
}
function runWorker(action, keys = []) {
  stopWorker();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./web-worker.mjs', import.meta.url), { type: 'module' });
    const id = ++operation;
    const timer = setTimeout(() => finish(new Error('处理超过 10 秒，已停止。请缩小文件后重试。')), 10000);
    const finish = (error, value) => {
      clearTimeout(timer);
      worker.terminate();
      if (pending?.id === id) pending = null;
      error ? reject(error) : resolve(value);
    };
    pending = { id, finish };
    worker.onmessage = ({ data }) => {
      if (pending?.id !== id || data.id !== id) return;
      finish(data.ok ? null : new Error(data.error), data.value);
    };
    worker.onerror = event => { event.preventDefault(); finish(new Error('浏览器无法完成处理，请重新选择文件后重试。')); };
    worker.postMessage({ id, action, keys, beforeText: slots.before.text, afterText: slots.after.text });
    refresh();
  });
}
async function inspectFiles() {
  if (Object.values(slots).some(slot => slot.text === null || slot.loading)) return;
  const current = revision;
  notice('正在检查文件格式…');
  try {
    const value = await runWorker('inspect');
    if (current !== revision) return;
    schema = value;
    for (const name of ['before', 'after']) {
      $(name + '-meta').textContent = `${value[name].count.toLocaleString('zh-CN')} 条记录 · ${value[name].header.length} 列`;
    }
    $('key-placeholder').hidden = true;
    $('key-list').replaceChildren();
    const preferred = value.before.header.find(h => h === '订单号') || value.before.header.find(h => h.toLowerCase() === 'id');
    for (const name of value.before.header) {
      const label = element('label', undefined, 'key-chip');
      const input = element('input');
      input.type = 'checkbox'; input.value = name; input.checked = name === preferred;
      label.append(input, element('span', name));
      input.addEventListener('change', () => { invalidate(true); notice('配对编号已更新，请重新开始对比。'); });
      $('key-list').append(label);
    }
    notice(preferred ? '格式检查通过。请确认配对编号，然后开始对比。' : '格式检查通过。请选择能唯一识别记录的编号列。');
  } catch (error) {
    if (current === revision && error.name !== 'AbortError') notice(explain(error), true);
  } finally { refresh(); }
}
async function loadFile(name, file, sample = false) {
  const slot = slots[name], loadId = ++slot.loadId;
  slot.file = file; slot.text = null; slot.loading = !!file; slot.sample = sample; slot.error = null;
  invalidate();
  $(name + '-name').textContent = file?.name || (name === 'before' ? '选择上期文件' : '选择本期文件');
  $(name + '-meta').textContent = file ? '正在读取…' : '点击选择 .csv 文件';
  if (!file) { notice('请选择两份 CSV 文件。'); return; }
  const showReadState = () => {
    const failures = Object.entries(slots).filter(([, item]) => item.error);
    if (failures.length) notice(failures.map(([side, item]) => (side === 'before' ? '上期：' : '本期：') + item.error).join('；'), true);
    else notice(Object.values(slots).some(item => item.loading) ? '正在读取文件…' : '已读取一份文件，请选择另一份。');
  };
  showReadState();
  try {
    if (file.size > 1000000) throw new Error('文件超过 1 MB（1,000,000 字节）演示上限。');
    if (!/\.csv$/i.test(file.name)) throw new Error('请选择 .csv 文件；本页不读取 XLSX。');
    const buffer = await file.arrayBuffer();
    if (loadId !== slot.loadId) return;
    try { slot.text = new TextDecoder($(name + '-encoding').value, { fatal: true }).decode(buffer); }
    catch { throw new Error('无法按所选编码读取，请根据来源系统更换编码。'); }
    $(name + '-meta').textContent = `${file.size.toLocaleString('zh-CN')} 字节 · 已读取`;
  } catch (error) {
    if (loadId === slot.loadId) {
      slot.text = null;
      $(name + '-meta').textContent = '未能读取';
      slot.error = explain(error);
    }
  } finally {
    if (loadId === slot.loadId) {
      slot.loading = false;
      refresh();
      if (Object.values(slots).every(item => item.text !== null && !item.loading)) await inspectFiles();
      else showReadState();
    }
  }
}
for (const name of ['before', 'after']) {
  $(name + '-file').addEventListener('change', event => loadFile(name, event.target.files[0] || null));
  $(name + '-encoding').addEventListener('change', () => {
    if (slots[name].file) loadFile(name, slots[name].file, slots[name].sample);
  });
}
function clearFiles(message = '已清空本次数据。请选择文件，或试用示例。') {
  for (const name of ['before', 'after']) {
    const slot = slots[name];
    slot.loadId++; slot.file = null; slot.text = null; slot.loading = false; slot.sample = false; slot.error = null;
    $(name + '-file').value = ''; $(name + '-encoding').value = 'utf-8';
    $(name + '-name').textContent = name === 'before' ? '选择上期文件' : '选择本期文件';
    $(name + '-meta').textContent = '点击选择 .csv 文件';
  }
  invalidate(); notice(message);
}
$('clear').addEventListener('click', () => clearFiles());
$('cancel').addEventListener('click', () => {
  if (Object.values(slots).some(slot => slot.loading)) clearFiles('已停止读取并清空本次数据。');
  else { invalidate(!!schema); notice('已停止处理。可重新开始对比或选择文件。'); }
});
$('sample').addEventListener('click', () => {
  clearFiles();
  const samples = {
    before: '订单号,客户,金额,状态\n001,青山书店,120,已发货\n002,南风文具,200,待确认\n003,林间小铺,85,待付款\n',
    after: '状态,金额,客户,订单号\n已发货,120,青山书店,001\n已付款,250,南风文具,002\n待确认,168,星河书屋,004\n',
  };
  for (const name of ['before', 'after']) loadFile(name, new File([samples[name]], `示例-${name}.csv`, { type: 'text/csv' }), true);
  $('workspace').scrollIntoView({ block: 'start' });
});
$('compare').addEventListener('click', async () => {
  if (!schema || !selectedKeys().length || pending) return;
  invalidate(true);
  const current = revision;
  notice('正在逐条比较…');
  try {
    const value = await runWorker('compare', selectedKeys());
    if (current !== revision) return;
    result = value;
    $('result-source').textContent = `${Object.values(slots).every(slot => slot.sample) ? '虚构示例 · ' : ''}上期 ${value.summary.before} 条 → 本期 ${value.summary.after} 条`;
    for (const [key, label] of [['added', '新增记录'], ['removed', '移除记录'], ['changed', '修改记录'], ['unchanged', '未变记录']]) {
      const card = element('div', undefined, 'stat');
      card.append(element('span', label), element('strong', value.summary[key].toLocaleString('zh-CN')), element('small', '条'));
      $('stats').append(card);
    }
    $('results').hidden = false;
    switchView('changed');
    notice('对比完成。可切换明细类别，或下载完整报告。');
    $('results').scrollIntoView({ block: 'start' });
  } catch (error) {
    if (current === revision && error.name !== 'AbortError') notice(explain(error), true);
  } finally { refresh(); }
});
function switchView(nextView) {
  if (!result) return;
  view = nextView; page = 0;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
  detailRows = view === 'changed' ? result.changed.flatMap(row => row.fields.map(field => [...result.keys.map(key => row.key[key]), field.column, field.before, field.after]))
    : result[view].map(row => schema.before.header.map(key => row[key]));
  renderTable();
}
function renderTable() {
  const columns = view === 'changed' ? [...result.keys, '变更字段', '修改前', '修改后'] : schema.before.header;
  const count = detailRows.length, start = page * pageSize, end = Math.min(start + pageSize, count);
  $('table-note').textContent = view === 'changed' ? `${result.summary.changed} 条记录有变化，共 ${count} 个字段。空白单元格表示空字符串。` : `共 ${count} 条${view === 'added' ? '新增' : '移除'}记录。保留原始字段文本。`;
  $('table-container').replaceChildren();
  if (!count) $('table-container').append(element('p', '这一类别没有变化记录。', 'empty'));
  else {
    const table = element('table'), head = element('thead'), header = element('tr'), body = element('tbody');
    columns.forEach(name => { const cell = element('th', name); cell.scope = 'col'; header.append(cell); });
    head.append(header);
    for (const row of detailRows.slice(start, end)) {
      const tr = element('tr');
      row.forEach((value, index) => tr.append(element('td', value, view === 'changed' && index >= columns.length - 2 ? (index === columns.length - 2 ? 'before-value' : 'after-value') : undefined)));
      body.append(tr);
    }
    table.append(head, body); $('table-container').append(table);
  }
  $('page-info').textContent = count ? `${start + 1}–${end} / ${count} 项 · 每页 ${pageSize} 项` : '0 项';
  $('previous').disabled = page === 0;
  $('next').disabled = end >= count;
  $('table-container').scrollTop = 0;
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));
$('previous').addEventListener('click', () => { if (result && page > 0) { page--; renderTable(); } });
$('next').addEventListener('click', () => { if (result && (page + 1) * pageSize < detailRows.length) { page++; renderTable(); } });
function download(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = element('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('download-json').addEventListener('click', () => {
  if (result && !pending) download(JSON.stringify(result, null, 2) + '\n', 'application/json;charset=utf-8', 'csv-changes.json');
});
$('download-html').addEventListener('click', async () => {
  if (!result || pending) return;
  const current = revision;
  notice('正在生成完整报告…');
  try {
    const html = await runWorker('report', result.keys);
    if (current !== revision) return;
    download(html, 'text/html;charset=utf-8', 'csv-changes.html');
    notice('完整报告已交给浏览器下载。报告含原始数据，分享前请脱敏。');
  } catch (error) {
    if (current === revision && error.name !== 'AbortError') notice(explain(error), true);
  } finally { refresh(); }
});
refresh();
