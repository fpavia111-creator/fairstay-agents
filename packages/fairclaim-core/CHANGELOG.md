# Changelog

## 0.2.0 (unreleased, Fairclaim ver 2)

Fixed:

- Modifier conflicts: the list missed AA with QY, QK with QY, AA with QZ, 25 with 57, and NU, RR and UE together; all are now conflicts (Dill and Sage).
- Reason code overrides: a config override given as just a category ("197": "documentation") was ignored and left the category blank; both the short and the object form now work.
- Open Dental layout: a procedure-log query that includes ProcStatus also lists treatment-planned, existing and deleted procedures; only completed ones are read now (Anise).

Added:

- Contract test: every listed value of every choice argument is run against each tool's eval case and must not end in an internal error.
- Open Dental procedure-log layout checked against Open Dental's published field names; Tebra and Availity layouts now carry a note on what their public help says.
- Tests: 131.

## 0.1.0 (unreleased, Fairclaim ver 1, 2026-11-17)

First version. The runtime (policy, approvals, audit log, memory, MCP server, readers for
CSV, TSV, JSON and Excel, text encodings, amounts and dates from other markets, column
names in eight languages, `--lang` reports) starts from the core shared by the Mythos and
Fairhaul agent families, at the level of Mythos handoff ver 6. Fairclaim adds the medical
billing parts below.

Added
- Patient data masking (`phi.js`): `PhiMasker` with modes `mask` (default), `strict` and
  `off`. Names, member ids, record numbers and account numbers become stable keyed
  pseudonyms (`PT-`, `MBR-`, `MRN-`, `ACCT-`); birth dates become a birth year;
  addresses, phone numbers, e-mail addresses and Social Security numbers are removed, also
  inside free text. `strict` also masks claim numbers (`CLM-`), service dates, ZIP codes
  and ages. A field marked `phi` in a source is masked whatever its name. Applied
  to every result before it reaches the model; report files on disk keep real names.
- Healthcare X12 (`hc-x12.js`): readers for 837P/I/D, 835, 999, 277CA, 271 and 278, and
  `buildX12` to write interchanges for the fixtures and tests.
- Billing helpers (`billing.js`): NPI check digit, MBI format, ICD-10-CM and HCPCS shapes,
  CPT/HCPCS ranges (E/M, anesthesia, labs), modifiers table, tooth and quadrant
  designations, `payerKey` for matching payer names across files, dates and ages.
- Claims and remittances from exports (`billing-sources.js`): `readClaims`, `readRemits`,
  `groupClaims` and `groupRemits`, with named export layouts (`exports.js`) for common
  practice management systems, clearinghouses and payer portals, each with the columns it
  is recognised by.
- Denials (`denials.js`): CARC and RARC tables, group codes, `denialLines` and
  `categorise` into root-cause buckets.
- `decimalEvidence(values)`: votes on the decimal mark across a column, including
  multi-group grouping.
- Fixed demo key (`DEMO_PHI_KEY`) so demos print the same pseudonyms every run.

Fixed (found by the ver 1 checks)
- ICD-10 codes starting with U (U07.1) were rejected as malformed.
- A German export with `;` as delimiter read a units column value of `1.800` as 1.8: the
  decimal mark now follows the file's other number columns, then the delimiter.
- `payerKey` results are cached; it was the hottest function on 10,000-line files.
