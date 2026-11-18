# Fixtures

Fictional Cedar Hollow pharmacy and lab invoices for March 2026. Planted:

- R1901: apixaban billed twice on 4 March, a lab panel billed at 38 against a 14 contract rate, and a code on the consolidated billing exclusion list (`J9035`, a fictional example) billed to the facility during a Part A stay.
- R1902: on Medicaid, so the pharmacy should bill Medicaid, not the facility.
- R1903: discharged 12 March, but billed for 14 March.
- R1904: billed insulin on 16 March, while in the hospital. The 20 March line is fine.

`drafts/credit_request-example000001.md` is a fixed draft for the one-click approval cases. `rules-typo.json` misspells a setting, so the check refuses it.
