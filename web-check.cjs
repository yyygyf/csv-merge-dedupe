// Requires Playwright with Firefox. Serve this directory over HTTP before running.
const { firefox } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { resolve, join } = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const base = process.env.CSV_WEB_URL || 'http://127.0.0.1:4208/';
  const out = resolve(process.env.CSV_WEB_ARTIFACTS || 'web-check-output');
  await fs.mkdir(out, { recursive: true });
  const { compareCsv } = await import(pathToFileURL(join(__dirname, 'compare.mjs')));
  const { compareReport } = await import(pathToFileURL(join(__dirname, 'compare-report.mjs')));
  const browser = await firefox.launch({ headless: true });
  const checks = [], errors = [], external = [], methods = [];
  const pass = name => { checks.push(name); console.log('PASS:', name); };
  const file = (text, name = 'data.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(base) && !request.url().startsWith('blob:')) external.push(request.url());
      methods.push(request.method());
    });
    const ready = () => page.waitForFunction(() => !document.querySelector('#compare').disabled);
    const finished = () => page.waitForFunction(() => !document.querySelector('#results').hidden);
    const loadPair = async (before, after) => {
      await page.locator('#clear').click();
      await Promise.all([
        page.locator('#before-file').setInputFiles(file(before, 'before.csv')),
        page.locator('#after-file').setInputFiles(file(after, 'after.csv')),
      ]);
    };
    const run = async () => { await ready(); await page.locator('#compare').click(); await finished(); };
    const getDownload = async button => {
      const event = page.waitForEvent('download');
      await page.locator(button).click();
      const download = await event;
      const path = join(out, download.suggestedFilename());
      await download.saveAs(path);
      return fs.readFile(path, 'utf8');
    };
    const invalid = async (before, after, pattern, onCompare = false) => {
      await loadPair(before, after);
      if (onCompare) { await ready(); await page.locator('#compare').click(); }
      await page.waitForFunction(() => document.querySelector('#notice').classList.contains('error'));
      assert.match(await page.locator('#notice').innerText(), pattern);
      assert.equal(await page.locator('#results').isHidden(), true);
      assert.equal(await page.locator('#download-json').isDisabled(), true);
    };
    await page.goto(base, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#compare').isDisabled(), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip').evaluate(el => el === document.activeElement), true);
    await page.screenshot({ path: join(out, 'desktop-start.png'), fullPage: true });
    await page.locator('#sample').click();
    await run();
    assert.deepEqual(await page.locator('.stat strong').allTextContents(), ['1', '1', '1', '1']);
    assert.match(await page.locator('#result-source').innerText(), /虚构示例/);
    assert.equal(await page.locator('tbody tr').count(), 2);
    await page.screenshot({ path: join(out, 'desktop-report.png'), fullPage: true });
    pass('sample: four categories, two changed fields, keyboard entry and desktop layout');

    const before = '\ufeffid,note,amount\r\n001,"中文,订单\n第二行",1.00\r\n002,same,2\r\n003,gone,3\r\n';
    const after = 'amount,note,id\n1,"<img src=x onerror=alert(1)>",001\n2,same,002\n4,new,004\n';
    await loadPair(before, after); await run();
    assert.match(await page.locator('tbody').innerText(), /001/);
    assert.equal(await page.locator('tbody img').count(), 0);
    assert.match(await page.locator('tbody').innerText(), /<img src=x/);
    assert.deepEqual(JSON.parse(await getDownload('#download-json')), compareCsv(before, after, ['id']));
    assert.equal(await getDownload('#download-html'), compareReport(before, after, ['id']).html);
    await page.locator('[data-view="added"]').click(); assert.match(await page.locator('tbody').innerText(), /004/);
    await page.locator('[data-view="removed"]').click(); assert.match(await page.locator('tbody').innerText(), /003/);
    pass('concurrent file reads; BOM/CRLF/multiline/Unicode/leading zeros; reordered columns; text-safe DOM; downloaded JSON and HTML exactly match CLI');

    await invalid('id,v\n1,a\n1,b', 'id,v\n1,a', /编号重复/, true);
    await invalid('id,v\n1,a', 'id,v\n,b', /编号为空/, true);
    await invalid('id,v\n1,a', 'id,w\n1,a', /列名不一致/);
    await invalid('id,v\n1,"abc', 'id,v\n1,a', /未闭合/);
    await invalid('id,v\n1,a"bc', 'id,v\n1,a', /引号格式/);
    await invalid('id,v\n1', 'id,v\n1,a', /字段数量/);
    await invalid('id,id\n1,a', 'id,id\n1,a', /重复列名/);
    await invalid('', 'id\n1', /表头为空/);
    pass('invalid key, schema, quoting, field count and empty-file failures hide old results and disable downloads');

    await loadPair('a,b,v\nx|y,z,old\nx,y|z,same', 'b,v,a\nz,new,x|y\ny|z,same,x');
    await page.waitForFunction(() => !document.querySelector('#key-options').disabled);
    assert.equal(await page.locator('#compare').isDisabled(), true);
    await page.locator('#key-list input[value="a"]').check();
    await page.locator('#key-list input[value="b"]').check();
    await run();
    assert.deepEqual(await page.locator('.stat strong').allTextContents(), ['0', '0', '1', '1']);
    await page.locator('#key-list input[value="b"]').uncheck();
    assert.equal(await page.locator('#results').isHidden(), true);
    pass('explicit composite keys avoid delimiter collisions; key changes invalidate report');

    await loadPair('__proto__,v\n001,old', 'v,__proto__\nnew,001');
    await page.waitForFunction(() => !document.querySelector('#key-options').disabled);
    await page.locator('#key-list input').first().check(); await run();
    assert.match(await page.locator('tbody').innerText(), /001/);
    await loadPair('id,v\n', 'v,id\n'); await run();
    assert.deepEqual(await page.locator('.stat strong').allTextContents(), ['0', '0', '0', '0']);
    assert.match(await page.locator('#table-container').innerText(), /没有变化记录/);
    pass('special column names and valid header-only CSV');

    await loadPair('id,v\n', 'id,v\n' + Array.from({ length: 123 }, (_, i) => `${i},row${i}`).join('\n'));
    await run(); await page.locator('[data-view="added"]').click();
    assert.equal(await page.locator('tbody tr').count(), 50);
    await page.locator('#next').click(); assert.match(await page.locator('#page-info').innerText(), /51–100/);
    await page.locator('#next').click(); assert.equal(await page.locator('tbody tr').count(), 23);
    assert.equal(await page.locator('#next').isDisabled(), true);
    await page.locator('#previous').click(); assert.match(await page.locator('#page-info').innerText(), /51–100/);
    pass('123-row pagination: 50/50/23, previous and last-page controls');

    await invalid('id\n' + 'x'.repeat(1000000), 'id\n1', /超过 1 MB/);
    await invalid('id\n' + Array.from({ length: 10001 }, (_, i) => i).join('\n'), 'id\n1', /10,000 条/);
    const columns = Array.from({ length: 101 }, (_, i) => 'c' + i).join(',');
    await invalid(columns, columns, /100 列/);
    await invalid(Buffer.from([0x69, 0x64, 0x0a, 0xff]), 'id\n1', /无法按所选编码/);
    pass('byte, record, column and invalid encoding limits');

    const gbk = Buffer.concat([Buffer.from('id,v\n001,'), Buffer.from([0xd6, 0xd0, 0xce, 0xc4])]);
    await loadPair(gbk, 'id,v\n001,中文');
    await page.locator('#before-encoding').selectOption('gbk'); await run();
    assert.equal(await page.locator('.stat strong').last().innerText(), '1');
    // U+1F600 = 94 39 FC 36 in GB18030, exercising a four-byte sequence GBK cannot decode.
    const gb18030 = Buffer.concat([Buffer.from('id,v\n001,'), Buffer.from([0x94, 0x39, 0xfc, 0x36])]);
    await loadPair(gb18030, 'id,v\n001,😀');
    await page.locator('#before-encoding').selectOption('gb18030'); await run();
    assert.equal(await page.locator('.stat strong').last().innerText(), '1');
    for (const encoding of ['utf-16le', 'utf-16be']) {
      const bytes = Buffer.from('id,v\n001,中文', 'utf16le');
      if (encoding === 'utf-16be') bytes.swap16();
      await loadPair(bytes, 'id,v\n001,中文');
      await page.locator('#before-encoding').selectOption(encoding); await run();
      assert.equal(await page.locator('.stat strong').last().innerText(), '1');
    }
    pass('explicit GBK, four-byte GB18030, UTF-16 LE and BE decoding');

    // Hold actual File reads in this test page, then release after reset/replacement.
    await page.evaluate(() => {
      const original = File.prototype.arrayBuffer;
      window.releaseReads = [];
      File.prototype.arrayBuffer = function () {
        const value = original.call(this);
        return this.name === 'slow.csv' ? new Promise(resolve => window.releaseReads.push(() => resolve(value))) : value;
      };
    });
    await page.locator('#before-file').setInputFiles(file('id\nold', 'slow.csv'));
    await page.locator('#clear').click();
    await page.evaluate(() => window.releaseReads.splice(0).forEach(release => release()));
    await page.waitForTimeout(60);
    assert.equal(await page.locator('#before-name').innerText(), '选择上期文件');
    assert.equal(await page.locator('#compare').isDisabled(), true);
    await page.locator('#before-file').setInputFiles(file('id\nold', 'slow.csv'));
    await page.locator('#before-file').setInputFiles(file('id\nnew', 'new.csv'));
    await page.locator('#after-file').setInputFiles(file('id\nnew', 'new.csv'));
    await page.evaluate(() => window.releaseReads.splice(0).forEach(release => release()));
    await run(); assert.equal(await page.locator('.stat strong').last().innerText(), '1');
    pass('late File read after clear or replacement cannot restore stale data');

    await page.route('**/web-worker.mjs', async route => {
      const source = await fs.readFile(join(__dirname, 'web-worker.mjs'), 'utf8');
      await route.fulfill({ contentType: 'text/javascript', body: source + '\nconst originalHandler = self.onmessage; self.onmessage = event => setTimeout(() => originalHandler(event), 300);' });
    });
    await page.locator('#sample').click(); await ready();
    await page.locator('#compare').click();
    await page.locator('#cancel').click();
    await page.waitForTimeout(450);
    assert.equal(await page.locator('#results').isHidden(), true);
    assert.match(await page.locator('#notice').innerText(), /已停止/);
    await run();
    const noDownload = [];
    const listener = download => noDownload.push(download.suggestedFilename());
    page.on('download', listener);
    await page.locator('#download-html').click();
    await page.locator('#clear').click();
    await page.waitForTimeout(450);
    assert.deepEqual(noDownload, []);
    page.off('download', listener);
    await page.unroute('**/web-worker.mjs');
    pass('cancel terminates delayed comparison; reset prevents a stale report download');

    await page.route('**/web-worker.mjs', route => route.fulfill({ contentType: 'text/javascript', body: 'self.onmessage = () => {};' }));
    await page.locator('#sample').click();
    await page.waitForFunction(() => document.querySelector('#notice').textContent.includes('超过 10 秒'), null, { timeout: 15000 });
    assert.equal(await page.locator('#results').isHidden(), true);
    await page.unroute('**/web-worker.mjs');
    pass('unresponsive worker stops at the 10-second timeout');

    await page.locator('#sample').click(); await run();
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.deepEqual(await page.evaluate(async () => (await indexedDB.databases()).map(db => db.name)), []);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('#results').isHidden(), true);
    assert.equal(await page.locator('#before-file').inputValue(), '');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1440);
    assert.deepEqual(external, []);
    assert.ok(methods.every(method => method === 'GET'));
    assert.deepEqual(errors, []);
    pass('reload clears state; no browser storage, external requests, POSTs or uncaught page errors');

    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: join(out, 'mobile-start.png'), fullPage: true });
    await page.locator('#sample').click(); await run();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 375);
    await page.screenshot({ path: join(out, 'mobile-report.png'), fullPage: true });
    await page.locator('[data-view="added"]').click();
    assert.match(await page.locator('tbody').innerText(), /004/);
    pass('375px mobile: sample, category controls and no page-wide horizontal overflow');
    await fs.writeFile(join(out, 'validation.json'), JSON.stringify({ base, browser: await browser.version(), checks, errors, externalRequests: external, requestMethods: [...new Set(methods)], completedAt: new Date().toISOString() }, null, 2) + '\n');
    console.log(`${checks.length} check groups passed`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
