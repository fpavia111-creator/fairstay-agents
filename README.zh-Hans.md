# Fairstay (Fairstay)

*由 Claude 翻译；尚待母语人士审校。以英文 [README](README.md) 为准。*

面向美国专业护理机构（养老护理院）后台的 32 个小型 MCP 代理：在院人数、计费、催收、财务、薪资和所有权变更。 每个代理只负责**一项工作**，读取你的系统已经导出的文件，并在你的电脑上写出报告和草稿。

MIT 许可证 · Node 20 或更高版本 · 仅本地文件 · 无需凭据 · 仅虚构测试数据

固定价格的部署服务：[Fairstay](https://fair-agents.com/fairstay.html)。

## 试用

```bash
npm install
npm test
node packages/fairstay-census-billing/bin/fairstay-census-billing.js demo
node packages/fairstay-acquisition-underwriting/bin/fairstay-acquisition-underwriting.js demo
```

每个代理都有使用虚构文件的 `demo`、带自有测试用例的 `eval`，以及 MCP 服务器（`<agent> mcp --root <文件夹>`）。

## 代理列表

**计费与收入周期:** [`fairstay-census-billing`](packages/fairstay-census-billing), [`fairstay-eligibility-checks`](packages/fairstay-eligibility-checks), [`fairstay-payer-source`](packages/fairstay-payer-source), [`fairstay-part-a-claims`](packages/fairstay-part-a-claims), [`fairstay-medicaid-pending`](packages/fairstay-medicaid-pending), [`fairstay-patient-liability`](packages/fairstay-patient-liability), [`fairstay-part-b-therapy`](packages/fairstay-part-b-therapy), [`fairstay-next-payer-planning`](packages/fairstay-next-payer-planning), [`fairstay-hospice-room-and-board`](packages/fairstay-hospice-room-and-board), [`fairstay-crossover-claims`](packages/fairstay-crossover-claims)

**催收与申诉:** [`fairstay-collections`](packages/fairstay-collections), [`fairstay-denial-appeals`](packages/fairstay-denial-appeals)

**个案管理:** [`fairstay-managed-care-authorizations`](packages/fairstay-managed-care-authorizations), [`fairstay-length-of-stay`](packages/fairstay-length-of-stay)

**管理式医疗:** [`fairstay-managed-care-claims`](packages/fairstay-managed-care-claims), [`fairstay-mco-contracts`](packages/fairstay-mco-contracts)

**财务服务:** [`fairstay-payables-review`](packages/fairstay-payables-review), [`fairstay-bank-reconciliation`](packages/fairstay-bank-reconciliation), [`fairstay-13-week-cash-flow`](packages/fairstay-13-week-cash-flow), [`fairstay-borrowing-base`](packages/fairstay-borrowing-base), [`fairstay-covenant-tests`](packages/fairstay-covenant-tests), [`fairstay-month-end-close`](packages/fairstay-month-end-close), [`fairstay-cost-report`](packages/fairstay-cost-report), [`fairstay-ancillary-invoices`](packages/fairstay-ancillary-invoices), [`fairstay-vendor-contracts`](packages/fairstay-vendor-contracts), [`fairstay-propco-bookkeeping`](packages/fairstay-propco-bookkeeping)

**薪资与人员配置:** [`fairstay-payroll-audit`](packages/fairstay-payroll-audit), [`fairstay-staffing-and-pbj`](packages/fairstay-staffing-and-pbj), [`fairstay-payroll-accruals`](packages/fairstay-payroll-accruals)

**所有权变更与执照:** [`fairstay-change-of-ownership`](packages/fairstay-change-of-ownership), [`fairstay-licensing-calendar`](packages/fairstay-licensing-calendar)

**收购与承保:** [`fairstay-acquisition-underwriting`](packages/fairstay-acquisition-underwriting)

## 如何保证安全

- **仅本地文件。** 不登录诊所软件、付款方门户、银行或政府系统；无网络调用，无遥测。
- **在模型看到之前先做掩码。** 患者、住户和员工姓名会变成化名（`PT-3f9a1c2e`）。
- **由人发送。** 每个代理都拒绝提交、付款、申报或发送；草稿须等待指定人员点击。
- **用设置代替写死的规则。** 费率、上限和期限都是由你确认的 JSON 设置。

## 局限

不提供法律、税务、计费或医疗建议。掩码是一种设计选择，不是 HIPAA 判定。列名尚未在真实导出文件上验证；首次部署时会与你一起确认。可读取九种语言的文件（编码、数字、日期、列名）；结果和 CSV 保持英文。

## 许可证

MIT。详情见英文 README。
