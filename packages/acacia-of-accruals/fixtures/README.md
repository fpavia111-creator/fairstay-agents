# Fixtures

Cedar Hollow payroll accruals for March 2026, with employer taxes of 8.5% and a tolerance of 100. Planted:

- Nursing: the 15 to 28 March period is paid 3 April, so all of it is accrued. The 29 March to 11 April period is 3 of 14 days in March. Together that is 7378 with taxes, against 6100 booked.
- Dietary: the 1 to 14 March period was paid 20 March, so only the late-March share is accrued.
- Housekeeping: PTO liability is 1519 with taxes, against 900 booked.

Employee names and ids are in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells a setting, so the check refuses it.
