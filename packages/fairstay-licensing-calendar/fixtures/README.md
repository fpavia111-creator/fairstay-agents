# Fixtures

Fictional licenses for Cedar Hollow and Bluebonnet Manor, checked on 1 April 2026 with a 60-day warning. Planted:

- An RN license expired 15 March with no renewal on file.
- A CNA on the roster (written "C.N.A.") has no certification on the list.
- The Cedar Hollow CLIA certificate expired 20 March; the renewal was filed 25 February and is not yet issued.
- Bluebonnet Manor has no CLIA entry.
- An LPN license expires 30 April and the Medicare revalidation is due 15 May.
- The fire marshal inspection has no date.
- A dietary aide is on the roster and is correctly not checked for a license.

Staff names and license numbers are in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells `warn_days`, so the check refuses it.
