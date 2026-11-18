# Fixtures

A fictional Cedar Hollow AP register reviewed on 31 March 2026. Planted:

- Lone Star Linen invoice LL-2201 entered twice.
- Prairie Medical Supply invoice PM-8810: 6380 on a 5500 PO and 19 days past due.
- Gulf Coast Pharmacy asks for payment to a bank account that is not the one on file.
- City Power and Light has no PO, but it is PO exempt.
- Hilltop Floor Care is not an approved vendor and has no PO.
- Bluebonnet Food Service has no PO for 4200.
- PO-904 was received on 28 March with no invoice yet, so it is accrued.

Bank account numbers are listed in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells a setting, so the check refuses it.
