# Browser snapshot comparison

[Open the demo](https://yyygyf.github.io/csv-merge-dedupe/). It is a static client-side page: no account, backend, analytics, third-party fonts or paid API. The included example is fictional. Custom-work prices shown on the page are indicative quotations, not an automatic checkout or evidence of sales.

## Behavior and limits

- Select two comma-delimited `.csv` files, choose an explicit encoding, then select one or more key columns. `id` or `订单号` is preselected when present; confirm it is the right identifier. Values are compared as strings, retaining leading zeros. No amount calculation, business-rule validation, automatic encoding detection or XLSX import.
- Both snapshots must have the same unique, nonblank column names, in any order. Record widths must match. Every selected key component must be nonblank; the full composite key must be unique within each snapshot. Invalid input fails visibly without a success report.
- Each file is limited to **1,000,000 bytes, 10,000 records and 100 columns**. The worker also checks a 1,000,000 UTF-16-code-unit text limit. Records may span several physical lines inside quoted fields; diagnostic record numbers include the header as record 1.
- UTF-8, GBK, GB18030, UTF-16 LE and UTF-16 BE are separate choices. Invalid sequences fail. Some incorrectly chosen encodings can still produce valid but wrong text, so choose the source system's encoding and inspect the result.
- Parsing, comparison and full report generation run in disposable module workers with a 10-second operation timeout. New input, changed keys, reset or cancellation invalidates old work. File-read generation checks prevent late reads from restoring cleared/replaced data.
- The table shows at most 50 detail rows per page. A modified record can yield several changed-field rows. Counts are for records; downloads include all differences, not only the current page. HTML is escaped and contains no external resources or scripts; JSON is data, not executable code.
- File contents stay in memory in the current page. The app uses no localStorage, sessionStorage or IndexedDB. The **Clear** button, page reload or close ends the in-page session; this is not a claim of secure memory erasure. Downloads are files managed by the browser and are not deleted by Clear. Reports contain original field values; anonymize before sharing.
- GitHub Pages receives ordinary page/asset visits. Source/contact links are user-initiated navigation. A restrictive CSP disallows page connections and forms; loading module scripts/workers is allowed from the same origin. No file data is placed in URLs.

## Run locally

Serve the repository directory over HTTP; opening `index.html` through `file://` is not supported by module workers. For example, with Python installed:

```sh
python -m http.server 4208 --bind 127.0.0.1
```

Open `http://127.0.0.1:4208/`. Runtime assets are `index.html`, `web-style.css`, `web-app.mjs`, `web-worker.mjs` and `web-core.mjs`. GitHub Pages serves the main branch root with `.nojekyll`; no build step or server credentials are needed for the deployed page.

## Verify or change the code

The comparison, CSV parser and printable report are generated from the existing pure CLI functions. When those sources change, regenerate and rerun relevant checks:

```sh
node build-web-core.mjs
node build-web-core.mjs --check
node --test merge.test.mjs audit.test.mjs
node compare.mjs --self-test
node compare-report.mjs --self-test
node convert-encoding.mjs --self-test
```

For browser checks, make the `playwright` package and its Firefox browser available to Node, start the local server above, then run:

```sh
node web-check.cjs
```

The script accepts `CSV_WEB_URL` (default `http://127.0.0.1:4208/`) and `CSV_WEB_ARTIFACTS` (default `web-check-output`). It uses only synthetic file data, writes screenshots/downloads/`validation.json`, and exits nonzero on a failed assertion. Network interception and delayed File reads in the test page are test fixtures, not production hooks. It does not submit inquiries or access a mailbox.

Actual local verification on 2026-09-13: **Firefox 155, Node.js 24.19.0, Windows x64; 13 browser check groups passed**, plus six existing Node tests and three CLI self-tests. Browser coverage includes sample totals; concurrent reads; byte-equal JSON/HTML versus CLI; BOM/CRLF/multiline/Unicode/leading zeros; invalid schemas/keys/quoting; composite and special keys; header-only CSV; 50/50/23 pagination; file/record/column limits; four explicit non-UTF-8 encodings; stale reads, cancellation and stale download suppression; real 10-second timeout; reset/storage/network assertions; desktop 1440px and mobile 375px screenshots. The first run exposed an overwritten per-file error; that defect was fixed before the complete pass. Screenshots were visually inspected. Other browsers/devices have not received this full regression suite.

Developed by Codex under the account owner's authorization. This demonstration is not a production customer deployment.
