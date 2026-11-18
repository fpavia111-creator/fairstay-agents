# Fixtures

A fictional Cedar Hollow payroll for 1 to 14 March 2026 (workweeks start Sunday). Planted:

- E101: 42.5 hours a week, with 5 overtime hours paid correctly. The 420 creditor garnishment is over the 25% limit of 345.
- E102: an RN on 8/80, with 24 daily overtime hours paid. The 288 shift differential was left out of the overtime rate.
- E103: paid 76 hours with 72 on the clock. The child support order is within the 50% limit.
- E104: a missing clock-out on 9 March.
- E105: terminated 27 February and still paid.
- E106: worked 48 hours in week one and was paid no overtime.

Employee names and ids are in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells a setting, so the check refuses it.
