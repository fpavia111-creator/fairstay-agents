# Evergreen (Fairstay)

*由 Claude 翻译；尚待母语人士审校。以英文 [README](README.md) 为准。*

面向美国专业护理机构（养老护理院）后台的 32 个小型 MCP 代理：在院人数、计费、催收、财务、薪资和所有权变更。 每个代理只负责**一项工作**，读取你的系统已经导出的文件，并在你的电脑上写出报告和草稿。

MIT 许可证 · Node 20 或更高版本 · 仅本地文件 · 无需凭据 · 仅虚构测试数据

固定价格的部署服务：[Fairstay](https://fair-agents.com/fairstay.html)。

## 试用

```bash
npm install
npm test
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

每个代理都有使用虚构文件的 `demo`、带自有测试用例的 `eval`，以及 MCP 服务器（`<agent> mcp --root <文件夹>`）。

## 代理列表

**计费与收入周期:** [`oak-of-census`](packages/oak-of-census), [`birch-of-eligibility`](packages/birch-of-eligibility), [`cedar-of-payer-source`](packages/cedar-of-payer-source), [`pine-of-part-a`](packages/pine-of-part-a), [`maple-of-medicaid-pending`](packages/maple-of-medicaid-pending), [`spruce-of-liability`](packages/spruce-of-liability), [`aspen-of-part-b`](packages/aspen-of-part-b), [`hemlock-of-next-payer`](packages/hemlock-of-next-payer), [`elm-of-hospice`](packages/elm-of-hospice), [`rowan-of-crossovers`](packages/rowan-of-crossovers)

**催收与申诉:** [`alder-of-collections`](packages/alder-of-collections), [`larch-of-appeals`](packages/larch-of-appeals)

**个案管理:** [`poplar-of-authorizations`](packages/poplar-of-authorizations), [`yew-of-length-of-stay`](packages/yew-of-length-of-stay)

**管理式医疗:** [`willow-of-managed-care`](packages/willow-of-managed-care), [`mulberry-of-mco-contracts`](packages/mulberry-of-mco-contracts)

**财务服务:** [`sequoia-of-payables`](packages/sequoia-of-payables), [`cypress-of-cash`](packages/cypress-of-cash), [`redwood-of-cashflow`](packages/redwood-of-cashflow), [`hazel-of-borrowing-base`](packages/hazel-of-borrowing-base), [`linden-of-covenants`](packages/linden-of-covenants), [`sycamore-of-close`](packages/sycamore-of-close), [`chestnut-of-cost-report`](packages/chestnut-of-cost-report), [`ash-of-ancillaries`](packages/ash-of-ancillaries), [`walnut-of-vendor-contracts`](packages/walnut-of-vendor-contracts), [`beech-of-propco`](packages/beech-of-propco)

**薪资与人员配置:** [`holly-of-payroll`](packages/holly-of-payroll), [`magnolia-of-staffing`](packages/magnolia-of-staffing), [`acacia-of-accruals`](packages/acacia-of-accruals)

**所有权变更与执照:** [`olive-of-chow`](packages/olive-of-chow), [`fir-of-licensing`](packages/fir-of-licensing)

**收购与承保:** [`baobab-of-underwriting`](packages/baobab-of-underwriting)

## 如何保证安全

- **仅本地文件。** 不登录诊所软件、付款方门户、银行或政府系统；无网络调用，无遥测。
- **在模型看到之前先做掩码。** 患者、住户和员工姓名会变成化名（`PT-3f9a1c2e`）。
- **由人发送。** 每个代理都拒绝提交、付款、申报或发送；草稿须等待指定人员点击。
- **用设置代替写死的规则。** 费率、上限和期限都是由你确认的 JSON 设置。

## 局限

不提供法律、税务、计费或医疗建议。掩码是一种设计选择，不是 HIPAA 判定。列名尚未在真实导出文件上验证；首次部署时会与你一起确认。可读取九种语言的文件（编码、数字、日期、列名）；结果和 CSV 保持英文。

## 许可证

MIT。详情见英文 README。
