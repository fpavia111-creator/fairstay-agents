# Evergreen: nursing-home back-office agents (ver 1)

32 MCP agents for skilled nursing facilities (SNFs), one for every service on the back-office brochure from ECAP West 26: revenue cycle, collections, case management, managed care, financial services, payroll, change of ownership and licensing, and acquisitions. Each one reads the files a nursing home already exports (census, claims, aging, bank, payroll, contracts), flags what a biller, AP clerk or controller would catch by hand, and writes a CSV worklist and an HTML report for staff.

Built on `remedy-core` (masking, policy, approvals, audit log, MCP server, memory, nine-language reports) plus `evergreen-core` (census-day expansion, payer types, per-diem rates, aging buckets, nursing-home column names).

- **Local files only.** No logins to PointClickCare, MatrixCare, a payer portal, a bank or a state system. No network calls, no telemetry.
- **Masked before the model sees it.** Resident and staff names become pseudonyms (`PT-3f9a1c2e`), record and account numbers become `MRN-…` and `ACCT-…`, e-mails and phones are removed. The report files on disk keep real names for staff.
- **People send.** Every agent refuses the live action next to its job (submitting claims or appeals, paying vendors, filing with CMS or a state, sending notices or offers). Drafts that could go out wait for one named click, even in Auto, tied to the sha256 of the draft.
- **Settings, not hard-coded rules.** Rates, limits, thresholds and lead times are JSON settings you pass. A misspelled setting is refused by name.
- **Fictional data only.** Cedar Hollow, Bluebonnet Manor and every resident, plan and vendor in the fixtures are made up.

This is **not** a HIPAA compliance determination, and not billing, legal, tax, accounting or clinical advice. The PointClickCare, MatrixCare and American HealthTech column names were written from public help pages and general knowledge and **have not been checked against real exports**.

## The 32 agents

### Billing and revenue cycle

| Agent | What it checks |
|---|---|
| [oak-of-census](packages/oak-of-census) | Census against billing for nursing homes: days billed to the wrong payer, unbilled or over-billed days, leave days billed to a payer that does not pay bed holds, days after discharge, overlapping census rows and per-diem rates that differ from your rate table. |
| [birch-of-eligibility](packages/birch-of-eligibility) | Eligibility for nursing-home residents: stale or missing checks, inactive or ending coverage, Medicare Part A benefit days running out, missing or short qualifying hospital stays, late admissions after the hospital stay and Medicaid renewals coming due. |
| [cedar-of-payer-source](packages/cedar-of-payer-source) | Payer source for every resident day: days with no payer, two payers on the same day, payers missing from your payer list, Medicare Part A past day 100, coinsurance days with no secondary payer, hospice residents on the wrong payer and private pay with no responsible party. |
| [pine-of-part-a](packages/pine-of-part-a) | Medicare Part A SNF claim checks (UB-04 / 837I lines): HIPPS codes on revenue code 0022, default ZZZZZ rates, covered days against the census, coinsurance days after day 20, the qualifying-stay span, claims that cross a month and through dates in the future. |
| [maple-of-medicaid-pending](packages/maple-of-medicaid-pending) | Medicaid pending oversight: applications past the decision deadline, document requests due, no follow-up, approvals not yet billed, approvals with no patient liability set, denials with no appeal and pending residents with no application on file. |
| [spruce-of-liability](packages/spruce-of-liability) | Patient liability (Medicaid share of cost) and private pay: liability not billed, billed short or over, unpaid balances, credit balances to refund and new liability notices not applied. |
| [aspen-of-part-b](packages/aspen-of-part-b) | Medicare Part B therapy for long-term residents: units over the 8-minute rule, missing GP/GO/GN modifiers, the KX threshold, therapy billed on days the resident was in a Part A stay, and duplicate lines. |
| [hemlock-of-next-payer](packages/hemlock-of-next-payer) | Next payer planning for long stays: residents whose Medicare days, managed care authorizations or private funds run out with no next payer planned, and when to start a Medicaid application. |
| [elm-of-hospice](packages/elm-of-hospice) | Hospice room and board for nursing-home residents: days not invoiced to the hospice, invoiced days that differ from the census, rates below the hospice contract, unpaid invoices, hospices with no contract and Medicaid billed directly for hospice days. |
| [rowan-of-crossovers](packages/rowan-of-crossovers) | Medicare-to-Medicaid crossovers for dual-eligible residents: Medicare coinsurance never crossed over, crossovers billed for the wrong amount, zero-paid crossovers to check against the state's lesser-of rule, and unpaid coinsurance to keep for the bad debt log. |

### Collections and appeals

| Agent | What it checks |
|---|---|
| [alder-of-collections](packages/alder-of-collections) | Nursing-home collections: aging by payer type with the reason each account is stuck, no follow-up, timely filing at risk, credit balances and Medicaid pending balances, as a monthly status report. |
| [larch-of-appeals](packages/larch-of-appeals) | Denial appeals for nursing homes: deadlines by payer and level, appeals past due, decisions overdue, the next appeal level, and appeal letter drafts a person approves and sends. |

### Case management

| Agent | What it checks |
|---|---|
| [poplar-of-authorizations](packages/poplar-of-authorizations) | Managed care authorizations against the daily census: days with no authorization, levels that differ from the authorized level, days past the authorized count, authorizations about to end and concurrent reviews due. |
| [yew-of-length-of-stay](packages/yew-of-length-of-stay) | Case management weekly meeting list for skilled stays: clinical reviews overdue, authorizations ending with no plan, discharges past their date, custodial residents still on a skilled payer, Medicare day 20 and day 100 coming up, and late NOMNC notices. |

### Managed care

| Agent | What it checks |
|---|---|
| [willow-of-managed-care](packages/willow-of-managed-care) | Managed care (HMO, Medicare Advantage, Medicaid MCO) claim checks: no contract rate, billed or paid below contract, levels not authorized, days past the authorization and claims missing the authorization number. |
| [mulberry-of-mco-contracts](packages/mulberry-of-mco-contracts) | Managed care contract review: per-diem rates below your market benchmark, paid below contract, contracts ending or in their notice window, rates unchanged for years, and a payer matrix for the admissions team. |

### Financial services

| Agent | What it checks |
|---|---|
| [sequoia-of-payables](packages/sequoia-of-payables) | Accounts payable review for nursing homes: duplicate invoices, vendors not on the approved list, invoices over the purchase order, missing purchase orders, past-due bills and goods received but not invoiced for the month-end accrual. |
| [cypress-of-cash](packages/cypress-of-cash) | Daily bank reconciliation: bank lines with no book entry, book entries not on the bank, stale outstanding checks, deposits in transit too long and the unexplained difference. |
| [redwood-of-cashflow](packages/redwood-of-cashflow) | 13-week cash projection for a nursing home from opening cash, AR collection rates by payer type, payroll dates, bills due and fixed payments, with the weeks below your minimum cash. |
| [hazel-of-borrowing-base](packages/hazel-of-borrowing-base) | Borrowing base certificate preparation: eligible receivables by payer type, ineligibles by reason (age, Medicaid pending, credits, cross-aging, concentration), availability at your advance rates and the room left on the line. |
| [linden-of-covenants](packages/linden-of-covenants) | Loan and lease covenant tests for nursing homes: occupancy, rent coverage, debt service coverage, fixed charge coverage and days cash on hand, with cushions, near misses and reporting due dates. |
| [sycamore-of-close](packages/sycamore-of-close) | Month-end close checks for nursing homes: trial balance out of balance, big month-over-month swings, per-patient-day costs outside their usual range, missing recurring accruals, suspense balances, intercompany that does not net out and late close tasks. |
| [chestnut-of-cost-report](packages/chestnut-of-cost-report) | Cost report and audit support: patient days by payer tied out between the census, the cost report draft and the PS&R, and the prepared-by-client list for auditors, the bank and the Medicare contractor. |
| [ash-of-ancillaries](packages/ash-of-ancillaries) | Ancillary invoice review: pharmacy, therapy, lab, radiology and supply charges for residents not in the building, for residents whose payer should be billed instead, outside consolidated billing, above contract rates or duplicated, with credit request drafts. |
| [walnut-of-vendor-contracts](packages/walnut-of-vendor-contracts) | Vendor contract analysis: renewal notice dates, expired contracts still billing, spend with no contract, price increases above the contract escalator and charges above contracted rates. |
| [beech-of-propco](packages/beech-of-propco) | Property company bookkeeping for nursing-home real estate: rent short or unpaid, escalators not billed, operator (tenant) rent coverage and occupancy, leases ending and tenant financials not received. |

### Payroll and staffing

| Agent | What it checks |
|---|---|
| [holly-of-payroll](packages/holly-of-payroll) | Payroll audit for nursing homes: missing punches, paid hours that differ from punches, overtime under the 40-hour or 8/80 rule, shift differentials left out of the overtime rate, garnishments over the limit and terminated staff paid. |
| [magnolia-of-staffing](packages/magnolia-of-staffing) | Staffing and PBJ checks: hours per resident day by role against your targets, days without 8 consecutive RN hours, agency invoices against agency timecards and the PBJ due date. |
| [acacia-of-accruals](packages/acacia-of-accruals) | Payroll and PTO accruals at month end: wages earned but not paid by department, employer taxes, PTO liability change, and the difference from what is booked, as journal entry lines. |

### Change of ownership and licensing

| Agent | What it checks |
|---|---|
| [olive-of-chow](packages/olive-of-chow) | Change of ownership (CHOW) tracker: every step for Medicare, Medicaid, the state license, payers, banking, payroll and vendors against the closing date, with late steps, steps due soon, blocked steps and standard steps missing from your list. |
| [fir-of-licensing](packages/fir-of-licensing) | Licensing and credentialing calendar: facility licenses, Medicare and Medicaid revalidations, CLIA and other certificates, administrator and nurse licenses, expired or expiring items, and standard items missing for a facility. |

### Acquisitions and underwriting

| Agent | What it checks |
|---|---|
| [baobab-of-underwriting](packages/baobab-of-underwriting) | Acquisition underwriting packet for a nursing home: trailing-twelve-month summary with one-time items removed, occupancy and payer mix, year-one projection, staffing model, value at your cap rate and valuation of receivables. |


## Try it (Node 20 or newer)

```bash
npm install
npm test                      # 733 tests across the core and 32 agents
npm run evals                 # 449 eval cases on the fictional fixtures
npm run hostile               # plants formulas, HTML, "../" and AI-aimed instructions in every fixture
npm run check                 # family rules: unique tools, refused tools, canaries, READMEs
npm run samples               # writes sample-reports/ (open sample-reports/index.html)
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

Every agent has `demo`, `eval`, `tools`, `sources`, `inspect` and `mcp`. In Claude Code before anything is published:

```bash
claude mcp add oak-of-census -- node /path/to/evergreen-agents/packages/oak-of-census/bin/oak-of-census.js mcp --root .
```

## Layout

```
packages/remedy-core       shared runtime (copied from the Remedy family, one masking fix, see REVIEW)
packages/evergreen-core    nursing-home helpers and the agent builder (snfAgent)
packages/<tree>-of-<job>   one agent: src/logic.js (pure), src/manifest.js, src/demo.js,
                           fixtures/, evals/cases.json, test/, README.md (generated)
scripts/new-agent.mjs      package boilerplate for every agent in scripts/agents.json
scripts/readme.mjs         writes every agent README from the agent itself
scripts/run-all-evals.mjs  all eval cases
scripts/hostile.mjs        hostile-input check (add --args for broken arguments on every tool)
scripts/family-check.mjs   family-wide rules
scripts/sample-reports.mjs the sample reports for prospects
```

## Licence

MIT. Nothing here is published to npm or GitHub yet.
