# Fixtures

Fictional Cedar Hollow dual-eligible residents, reviewed on 30 April 2026 with a Medicaid rate of 210 a day. Planted:

- R1201: Medicare paid 10 March and no crossover was ever sent.
- R1202: Medicaid paid nothing, which matches lesser-of, so the full coinsurance goes to the bad debt log.
- R1203: Medicare paid only 2400, so lesser-of says Medicaid owes 3480, but it paid nothing.
- R1204: the crossover billed 600 less than the coinsurance.
- R1205: the crossover was sent 12 March with no answer.
- R1206 is not dual eligible, and R1207's Medicare payment is only 10 days old, so both are left alone.
- R1208: Medicaid paid part of it, and the rest goes to the bad debt log.

`rules-typo.json` misspells a setting, so the check refuses it.
