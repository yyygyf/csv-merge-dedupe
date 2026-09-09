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


## 可读的变化报告（main 分支新增）

`compare-report.mjs` 把两期 CSV 的新增、删除和逐字段修改生成可直接在浏览器打开、打印的中文 HTML。此工具尚不包含在 v0.1.0 发布压缩包中；请在仓库 Code 菜单下载当前 main 分支 ZIP，或克隆当前仓库后运行：

```sh
node demo.mjs demo-output
node compare-report.mjs 订单号 demo-output/merged.csv demo-output/later.csv change-report.html
node compare-report.mjs --self-test
```

打开 `change-report.html`，应看到前后各 3 条记录，新增、删除、修改、未变各 1 条；修改明细显示订单 002 的金额从 200 变成 250。这里全部是虚构样例。

处理实际文件：`node compare-report.mjs 主键 before.csv after.csv report.html`。组合主键使用逗号分隔。规则与 JSON 对比相同，不覆盖现有输出；报告包含原始字段值，分享前须脱敏。工具比较字符串变化，不做金额汇总或业务正确性判断。

English: the main branch also includes `compare-report.mjs`, a printable HTML snapshot-difference report. It is not included in the v0.1.0 ZIP. Use the current main branch and the example above. Reports contain source values; redact before sharing.


## 中文导出文件的编码转换（main 分支新增）

现有清洗和报告工具仍只读取 UTF-8 CSV。对于已知编码的其他 CSV，可先用 `convert-encoding.mjs` 转换；下载当前 main 分支，v0.1.0 不包含此文件。

```sh
node convert-encoding.mjs gbk source.csv utf8.csv
node audit.mjs utf8.csv report.html --key id
node convert-encoding.mjs --self-test
```

支持显式指定 `utf-8`、`gbk`、`gb18030`、`utf-16le`、`utf-16be`；输出带 BOM 的 UTF-8、CRLF 行尾和标准 CSV 引号。保留字段字符串，包括 001 这样的编号。所有内容在内存中处理，无第三方依赖。公开版本已通过编码自检及命令行转换、拒绝覆盖、原文件保持不变的检查。

此工具不自动判断编码。错误的编码选择即使成功解码也可能产生乱码，请先确认来源系统的导出设置并抽样核对。发现 BOM 与选择冲突、非法字节、NUL、重复或空表头、字段数异常会报错，且不会创建输出；已有输出也会被拒绝。它不读取 XLSX，不修复业务数据，不改变公式文本。

English: `convert-encoding.mjs` converts explicitly selected GBK/GB18030/UTF-16 CSV exports to UTF-8 before using the other tools. It does not detect encodings. Validate the selected encoding and inspect representative output rows. It preserves field strings, normalizes CSV serialization, and refuses existing output paths.
