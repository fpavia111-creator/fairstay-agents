# Fixtures

A fictional 120-bed nursing home, T12 April 2025 to March 2026, with a 12.5% cap rate. Planted:

- September 2025 is missing from the T12, so recurring lines are annualized from 11 months.
- A 180,000 provider relief fund receipt (found by its name) and a 65,000 legal settlement (flagged one-time) come out of normalized EBITDAR.
- The seller charged a 3% management fee; the buyer underwrites 5%.
- Staffing 3.8 nursing hours per resident day at 38 an hour costs about 249,000 more a year than the T12 shows.
- Occupancy is 77% (92 average daily census) against an 85% target, and normalized EBITDAR covers rent 1.25 times against a 1.3 floor.
- A 210-day Medicaid pending balance is the largest receivables haircut.

Resident names and ids in the aging are in `phi-canaries.json`; they must never reach the model. The packet carries no resident names. `rules-typo.json` writes `cap` for `cap_rate`, so the check refuses it.
