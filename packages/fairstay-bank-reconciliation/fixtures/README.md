# Fixtures

A fictional Cedar Hollow operating account reconciled on 31 March 2026. Planted:

- The Medicare deposit was booked a day before the bank posted it. It still matches.
- Check 10443 cleared for 2650; the books have 2560.
- A managed care EFT and a card processing fee are on the bank statement but not in the books.
- Check 10101, a resident refund written in November, has not cleared, so it is stale.
- A private pay deposit booked 20 March is not on the bank statement.
- Check 10450 was written yesterday and is a normal outstanding check.
- After all of that, the bank is still 45 higher than the books.

The account number and the resident named in a memo are in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells a setting, so the check refuses it.
