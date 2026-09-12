# n8n CSV snapshot reconciliation demo

A runnable example for comparing two order, inventory or membership exports by a unique key. It returns added and removed records, field-level changes, and counts of unchanged records. All included orders are synthetic. Developed with Codex; this is a capability sample, not a customer deployment.

## Try the workflow

1. Download [csv-snapshot-demo.json](csv-snapshot-demo.json) from the current main branch. It is **not in the v0.1.0 release**.
2. In your n8n editor, import the workflow JSON from a file. Review the three connected nodes and the instruction note, then execute the workflow manually.
3. Open **Compare snapshots → Output → JSON**. The expected counts are:

| Before | After | Added | Removed | Changed | Unchanged |
| --- | --- | --- | --- | --- | --- |
| 3 | 3 | 1 | 1 | 1 | 1 |

Order `002` changes from amount string `200` to `250`; `003` is removed and `004` is added. Leading-zero identifiers remain strings. The sample also changes column order and includes a quoted comma.

No credentials or community nodes are required. The workflow contains a Manual Trigger and two JavaScript Code nodes; it has no outbound requests, schedule or file writes. Your n8n instance may still retain input/output in execution history according to its settings. Use synthetic or redacted data when evaluating or sharing runs.

## Input and output contract

Replace **Synthetic snapshots** with a node that supplies **one item** containing:

```json
{
  "beforeText": "id,amount\n001,100\n",
  "afterText": "id,amount\n001,120\n",
  "keys": ["id"]
}
```

For composite keys, use an array such as `["customer_id", "order_id"]`. Both snapshots must have the same exact column-name set; their order may differ. Duplicate keys, blank keys, duplicate/blank headers, malformed quoting and inconsistent row widths stop execution with an error. This workflow expects decoded text, not binary attachments or file paths.

One output item contains `schemaVersion`, `keys`, `summary`, `added`, `removed` and `changed`. Changed records include their key plus `{column, before, after}` for each changed field. Field values are compared exactly: `1`, `1.00`, whitespace differences and case differences are significant. There is no numeric aggregation, business-rule validation or automatic conflict resolution.

Limits **per snapshot**: 1,000,000 UTF-16 code units of text, 10,000 data records, and 100 columns. The comparison runs in memory. Only comma-separated CSV text is supported; XLSX, binary encodings, PDF extraction and production connectors are outside this sample.

## Reproducible verification

Locally executed on **2026-09-13 (Asia/Shanghai)** using **n8n 2.38.7**, **Node.js 24.19.0**, Windows x64, SQLite and n8n's internal JavaScript task runner. All three execution nodes returned `success`. This verifies the synthetic workflow in that environment; other n8n versions, editor import interactions, production deployments and client integrations have not been tested.

[sample-execution.json](sample-execution.json) is a projection of that actual CLI execution: timestamps, completion status and node results are retained; runtime resume metadata and instance details are omitted. It is a recorded result, not a substitute for rerunning n8n.

From the repository root:

```sh
node n8n/verify.mjs
node n8n/verify.mjs n8n/sample-execution.json
```

The first command runs 11 groups of checks against the JavaScript embedded in the workflow: change categories and exact values; quoting/BOM/multiline text; string preservation; composite keys; empty snapshots; duplicate keys; invalid rows/columns/keys; malformed CSV/headers; input shape; size limits; special object-property names. The second also verifies the recorded n8n execution and exact sample output (12 groups total). The verifier executes the bundled JavaScript; do not point it at untrusted workflow files.

To reproduce the actual execution with your installed n8n CLI, use a separate local test instance and its normal configuration:

```sh
n8n import:workflow --input=n8n/csv-snapshot-demo.json
n8n list:workflow
n8n execute --id=YOUR_IMPORTED_WORKFLOW_ID --rawOutput
```

Select the imported workflow's ID from the list. Importing and executing write to that instance's database. On the tested version, `--rawOutput` still appeared alongside startup logs; preserve the complete logs and extract the execution JSON before passing it to `verify.mjs`. A zero CLI exit code alone is not sufficient evidence of success.

The local run reported an unavailable Python task runner; this sample uses JavaScript only, and its JavaScript runner and workflow completed successfully. This was a development execution, not a persistent production service. The n8n runtime, installation dependencies and hosting are separate from this repository; this sample itself uses no paid API.

## 中文说明

这是可导入 n8n 的两期 CSV 核对样例，所有订单均为虚构。下载当前 main 分支中的工作流 JSON，导入 n8n 后手动执行，再查看 Compare snapshots 节点的 JSON 输出：新增、删除、修改、未变各 1 条，订单 002 的金额由字符串 200 变为 250。

已在 n8n 2.38.7 / Node.js 24.19.0 / Windows x64 中通过真实 CLI 导入和执行，附运行结果摘录及可重跑的验证脚本。界面导入步骤、其他版本和客户生产集成尚未验证。n8n 执行历史可能保存输入和输出，请按自己实例的配置处理。

实际接入时，上游节点应提供一个包含 `beforeText`、`afterText` 和 `keys` 数组的 JSON item。支持组合键、前导零、列顺序变化和带引号字段；空键、重复键、错误列数或非法 CSV 会失败。每份输入最多 100 万 UTF-16 码元、1 万条数据记录、100 列。此样例不读取 Excel/PDF，不做金额计算，不含定时任务或第三方连接器。

## Custom work

For a scoped CSV workflow or recurring report, [open a custom-work inquiry](https://github.com/yyygyf/csv-merge-dedupe/issues/new?template=custom-work.md) with synthetic samples, volume, rules and desired output. Scope, acceptance, price, delivery time, hosting costs and payment eligibility are agreed before any paid engagement. No completed client engagement or income is claimed by this demo.

Workflow SHA-256 for the recorded execution: `f23e52ad3ef01bcd2de08a0e914e8601e604cea3355c7c3a1bb610b96c848f5c`.
