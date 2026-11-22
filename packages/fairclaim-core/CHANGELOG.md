# Changelog

## 0.3.0 (2026-11-22, first npm release)

One fairclaim-core for all four products that use it. Before this, Fairclaim, Fairstay, Fairpractice and Fairpractice wave 2 each carried their own copy under the same name and version (0.2.1), with different files, so whichever copy reached npm first would have been wrong for the other three. This version is the union of the four copies.

Changed:

- Report footers name the product that wrote them, from the agent's package name (`fairstay-…` writes "Written by a Fairstay agent", `fairpractice-…` "Fairpractice", `fairclaim-…` "Fairclaim"), in all nine report languages. The four copies had the product name typed into the core. New export `brandOf(name)`.
- Everything in the 0.2.0 notes below that came from the Fairpractice final passes (repeated column names, the new `remedy-new-agent` names, over-long paths) is now in every product, not only Fairpractice. Fairclaim and Fairstay already had the CSV and path fixes in the shared engine; they now have the tests for them too.
- Package metadata points at the fairclaim-agents repository, the canonical home of this package.


## 0.2.0 (unreleased, Fairclaim ver 2)

Fixed:

- A repeated column name no longer loses data: the first column keeps the name and later ones become "Name (2)", "Name (3)". Before, the last column replaced the first, so the CMS physician fee schedule RVU file (a work "RVU" and a malpractice "RVU") was read with malpractice RVUs as work RVUs (Fairpractice wave 1 final pass, real-data run).
- `remedy-new-agent` takes `<product>-<what-it-does>` names (for example `fairclaim-denial-trends`; the tool prefix is the words after the product) and refuses the old `<figure>-of-<process>` names (Fairpractice wave 1 final pass, after the Fairclinic note).
- Over-long paths (more than 1,024 characters, or a folder or file name over 255) are refused by `safePath` with a plain message. A report `out_dir` of 200,000 characters made the recursive `mkdir` never return on Windows with Node 24 (found by the Fairpractice wave 2 hostile argument pass, 18 Nov 2026).

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
