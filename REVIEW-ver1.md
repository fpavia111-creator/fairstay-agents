# Evergreen ver 1: review

18 Nov 2026. What was built, how it was checked, what was found and fixed, and what is not checked yet.

## Scope
32 agents, one or more for every line of the back-office brochure from ECAP West 26 (see the mapping in `PLAN.md`, section 1), plus `evergreen-core` and a copy of `remedy-core`. Version 0.1.0 of every package; nothing published.

## Checks run, and results
| Check | Result |
|---|---|
| `npm test` (all workspaces, Node 22) | 733 tests, 733 pass |
| `npm run evals` | 449 eval cases across 32 agents, all pass (every agent has 13 to 17) |
| `npm run hostile` (formulas, HTML, `../` ids, AI-aimed instructions planted in every fixture, every eval case) | 2,240 calls, 0 findings after the fix below |
| `npm run hostile:args` (null, numbers, arrays, a 200,000-character string, `../` and absolute paths in every argument of every tool) | 15,471 calls, 0 findings |
| `npm run check` (family rules) | 32 agents, 228 distinct tool names, 32 prefixes, all pass |
| Masking canaries | Every agent lists at least 3 fictional identifiers; none reaches any eval result |
| MCP stdio smoke test | Every agent: initialize, list tools, refuse an unknown tool, write the audit log |
| `npm pack --dry-run` | All 34 packages pack |

## Found and fixed during the build
- **Masking gap (shared core):** a resident name with junk in front of it (for example a planted spreadsheet formula, `=HYPERLINK(...) Florence Adeyemi`) was not found inside text, so the raw name reached the model in 3 agents under the hostile check. `remedy-core/src/phi.js` now drops leading and trailing punctuation from a value before matching. Core tests still pass (131). **The Remedy family has the same core and should take this fix in its next version.**
- A generic description column marked as free-text PHI masked the word "CHECK" everywhere (cypress); generic employee names like "CNA 2" masked substrings (magnolia). Fixtures and field kinds corrected.
- Duplicate invoices counted toward purchase-order totals (sequoia); credit balances counted in gross receivables (hazel). Fixed with tests.
- Underwriting with a missing T12 month understated every line and overstated the staffing gap (baobab). Recurring lines are now annualized from the months given; one-time lines are not.
- Unrealistic fixture economics (cash flow payroll, covenant EBITDAR) rebalanced so the planted findings read like a real home.
- pine-of-part-a had no eval for a refused input; one added.

## Not checked yet (say this out loud)
- **Export layouts:** PointClickCare, MatrixCare and American HealthTech column names come from public help pages and general knowledge. No real export has been read. The first setup confirms them with `inspect`.
- **Rules:** Medicare, Medicaid, payroll and CHOW lead times are summarized from public material as of 2026 and are settings. A billing or payroll professional and a healthcare attorney should read the defaults.
- **Node 20 and 24:** only Node 22 was available here. `engines` says Node 20 or newer; run `npm test` on 20 and 24 before publishing.
- **Translations:** reports have titles in nine languages through the core, but the agent READMEs, sample reports and sales copy are English only. The Remedy family's `intl` check (foreign-language exports) was not ported yet.
- **Sample reports** show raw numbers (no thousands separators or currency); fine for staff, plain for prospects.
- No native-speaker, lawyer, billing-expert or customer review yet.

## Ideas for ver 2
Port the `intl` check and README translations; format money in reports; one real de-identified export per system to confirm columns; a family-level "monthly close pack" that runs several agents in order; the masking fix pushed back into Remedy.

## Decisions left for Francisco
Brand name Fairstay (unchecked); prices (proposals in `sales/pricing-page-ver1.md`); publishing to npm/GitHub; uploading the Fairstay page; lawyer and insurer before real resident data (PLAN section 7).
