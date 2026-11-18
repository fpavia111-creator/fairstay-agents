# Fixtures

A fictional Cedar Hollow March 2026 close (operating company and property company), checked on 6 April. Planted:

- The OpCo trial balance is out by 1200.
- Due-from PropCo is 95000, but PropCo's due-to is only 90000.
- Suspense holds 106310, and unapplied cash holds 6450 in three resident payments, the oldest 82 days old.
- No contract therapy was booked for March.
- Pharmacy is 11.14 per patient day, below its usual 20 to 32, and agency staffing more than doubled.
- The payroll accrual task is two days late, and ancillary accruals are due tomorrow.

Residents named in the unapplied cash detail are in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells a setting, so the check refuses it.
