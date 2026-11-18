# Fixtures

A fictional change of ownership at Cedar Hollow, closing 1 July 2026, checked on 1 April 2026. Planted:

- The state license application was due 25 March and is not filed (late).
- Medicaid CHOW enrollment waits on the Medicare CMS-855A, which is not filed (blocked). The 855A itself waited on the new EIN and NPI, which are done, so it is only due soon (2 April).
- Managed care credentialing (2 April) and vendor contracts (10 April) are due soon.
- The list has no step for the Medicare provider agreement decision, CLIA, CMS systems access (PBJ, iQIES) or the seller's terminating cost report.

Agency emails are in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells `close_date` as `closing`, so the check refuses it.
