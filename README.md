# CSV 数据处理工具包与定制服务

本仓库提供三类本地工具，使用 Node.js 22+，无需第三方依赖。开发使用 Codex；这是能力样例，不是客户成交案例。

| 工具 | 适用问题 | 输出 |
| --- | --- | --- |
| [合并去重](merge.mjs) | 同表头的多份 CSV 重复记录 | 合并 CSV 和终端统计 |
| [数据体检](DATA-AUDIT.md) | 必填值、重复编号、数字格式、字段数异常 | 中文 HTML 报告 |
| [快照对比](compare.mjs) | 两期订单、库存或名单变化 | 新增、删除、逐字段修改 JSON |

[下载 v0.1.0](https://github.com/yyygyf/csv-merge-dedupe/releases/tag/v0.1.0) · [提交定制需求](https://github.com/yyygyf/csv-merge-dedupe/issues/new?template=custom-work.md)

## 一键试用

下载发布页的 Source code (zip)，解压并进入该目录，运行：

```sh
node demo.mjs demo-output
```

全部输入为虚构订单数据。打开生成的 `demo-output/audit.html` 查看异常报告，`changes.json` 查看变化，`README.md` 查看验收结果。4 条来源记录合并为 3 条；体检定位 1 条异常记录；快照对比各有 1 条新增、删除、修改及未变记录。再次运行请换一个新输出目录。

## 处理自己的 CSV

```sh
node merge.mjs 订单号 merged.csv january.csv february.csv
node merge.mjs 客户号,订单号 merged.csv export1.csv export2.csv
node audit.mjs orders.csv report.html --required 订单号,金额 --key 订单号 --numbers 金额
node compare.mjs 订单号 before.csv after.csv changes.json
```

合并按原始字符串组合键保留首次记录，要求相同列名及顺序。快照对比允许列顺序不同，但要求列名集合一致，拒绝空键或重复键。工具保留前导零、中文、引号、逗号和字段内换行，不修改输入，不覆盖已有输出。

所有内容在内存处理；仅支持逗号分隔的 UTF-8 CSV，不支持 XLSX/GBK，不自动解决业务冲突，不修改公式文本。Excel 自行打开 CSV 仍可能改变数字显示格式。JSON 对比输出包含原始字段值，分享前须脱敏。

## 验证

```sh
node --test merge.test.mjs audit.test.mjs
node compare.mjs --self-test
```

公开版本已重新下载验证：6 项单元测试、对比自检、命令行输出保护及一键演示验收通过。

## 定制询价

可讨论字段映射、编码转换、合并去重、数据校验、快照核对和周期报告。小范围参考报价人民币 199–499 元，实际范围、验收、期限和付款方式须双方确认；开发使用 Codex，交付约定源码、说明和测试。周期任务可讨论按次或定期维护。

通过上方定制需求入口提供文件格式、大致行数、处理规则和期望输出，仅附虚构或脱敏样本。当前没有自动下单或收款功能；报价不是已成交收入。

## English

Local CSV merge/deduplication, validation and snapshot comparison. Download the release ZIP and run `node demo.mjs demo-output` with Node.js 22+. The generated report and JSON use synthetic data. No third-party dependencies. Custom automation inquiries are welcome through Issues; scope, acceptance criteria, price and payment are agreed separately. Developed with Codex; no client experience or sales is claimed.
