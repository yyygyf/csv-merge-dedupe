# CSV 数据处理工具包

把多份 CSV 合并去重，找出异常记录，并比较两次导出之间的变化。适合订单、库存和名单核对；保留中文、前导零和组合编号。独立工具在本地运行，使用 Node.js 22+，无需第三方依赖。

[下载 v0.2.0](https://github.com/yyygyf/csv-merge-dedupe/releases/tag/v0.2.0) · [n8n 工作流](n8n/README.md) · [定制询价](https://github.com/yyygyf/csv-merge-dedupe/issues/new?template=custom-work.md)

## 先看效果

从发布页下载 `csv-toolkit-v0.2.0.zip`，解压后双击 `example-output/audit.html` 或 `example-output/changes.html`，即可查看已生成的中文报告。查看样例无需安装 Node.js；样例中的订单全部为虚构。

安装 Node.js 22+ 后，在解压目录重新生成报告：

```sh
node demo.mjs my-demo-output
```

输出目录必须尚不存在。演示将 4 条来源记录合并为 3 条，定位 1 条异常记录，并生成 HTML 与 JSON 变化清单：新增、删除、修改、未变各 1 条，订单 `002` 的金额由字符串 `200` 变为 `250`。

GitHub 自动生成的 **Source code** 压缩包也包含全部工具；其中不附预生成报告，运行上述命令即可生成。

## 处理自己的文件

| 需要处理的问题 | 命令 | 结果 |
| --- | --- | --- |
| 合并同表头文件，以订单号去重 | `node merge.mjs 订单号 merged.csv january.csv february.csv` | CSV 与终端统计 |
| 检查必填值、重复编号与数字格式 | `node audit.mjs orders.csv audit.html --required 客户,金额 --key 订单号 --numbers 金额` | 中文异常报告 |
| 比较两期导出 | `node compare-report.mjs 订单号 before.csv after.csv changes.html` | 可打开、打印的变化报告 |
| 供后续程序读取变化 | `node compare.mjs 订单号 before.csv after.csv changes.json` | 新增、删除与逐字段修改 JSON |
| 转换已知 GBK 编码的 CSV | `node convert-encoding.mjs gbk source.csv utf8.csv` | UTF-8 CSV |

组合主键写为 `客户号,订单号`。合并保留首次出现的记录，要求相同表头及列顺序。对比允许列顺序不同，但要求列名集合一致，拒绝空键或重复键。所有工具保留字段原始字符串，不修改输入，也不覆盖已有输出。

编码转换须显式选择 `utf-8`、`gbk`、`gb18030`、`utf-16le` 或 `utf-16be`，不会自动判断编码。请根据来源系统选择并抽样核对；输出使用 UTF-8 BOM 与 CRLF 行尾。其他工具直接读取 UTF-8。

仅处理逗号分隔 CSV，全部内容在内存处理；不读取 XLSX、不计算金额、不自动修正业务数据或改变公式文本。Excel 打开 CSV 时仍可能自行改变数字格式。报告包含源字段值，分享实际数据前请脱敏。体检规则详见 [DATA-AUDIT.md](DATA-AUDIT.md)。

## 接入 n8n

导入 [n8n/csv-snapshot-demo.json](n8n/csv-snapshot-demo.json)，手动执行，再查看 **Compare snapshots → Output → JSON**。工作流接收 `beforeText`、`afterText` 和 `keys`，返回新增、删除及逐字段变化。

已在 n8n 2.38.7 / Node.js 24.19.0 / Windows x64 上实际通过 CLI 导入并执行，附运行记录与验证脚本。工作流无需凭据，没有外部请求；n8n 实例可能保存执行历史。每份快照上限为 100 万 UTF-16 码元、1 万条记录、100 列。二进制文件读取、定时任务和业务连接器需另行配置，详见 [完整步骤](n8n/README.md)。

## 自行验证

```sh
node --test merge.test.mjs audit.test.mjs
node compare.mjs --self-test
node compare-report.mjs --self-test
node convert-encoding.mjs --self-test
node n8n/verify.mjs n8n/sample-execution.json
```

最后一条会验证工作流内的 JavaScript 和保存的执行结果，不会启动新的 n8n 实例。实际 n8n 重跑命令见工作流说明。

## 定制与周期维护

可按实际导出格式定制字段映射、去重保留规则、校验条件、n8n 流程及周期报告。小范围参考价人民币 **199–499 元**，先用虚构样本确定预期输出，再约定交付范围、验收、期限与付款方式。定期运行或维护按范围另行报价。

[提交需求](https://github.com/yyygyf/csv-merge-dedupe/issues/new?template=custom-work.md)时，请附文件格式、大致行数、处理规则及 3–5 行虚构或脱敏样本。这里没有自动下单或收款功能。

本工具由 Codex 开发，公开演示是能力样例，不是客户项目或成交证明。

## English

A local CSV toolkit for merge/deduplication, data-quality checks, printable snapshot differences and explicit encoding conversion. Download `csv-toolkit-v0.2.0.zip` and open the HTML files under `example-output` to inspect synthetic examples. To reproduce them, install Node.js 22+ and run `node demo.mjs my-demo-output`. Standalone tools need no third-party dependencies.

An [n8n snapshot workflow](n8n/README.md) is included with a recorded successful local execution. It needs a separate n8n runtime. Custom automation and recurring-report inquiries are welcome through Issues; scope, acceptance, price and payment are agreed separately. Developed with Codex; the examples do not claim customer deployments or earnings.
