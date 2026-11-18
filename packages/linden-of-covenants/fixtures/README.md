# Fixtures

Fictional Cedar Hollow monthly financials from April 2025 to March 2026 (120 beds), tested on 20 April 2026. Occupancy falls from 86% to 79% in January and cash drops in February. Planted:

- Lease occupancy: 79% for the quarter against an 80% minimum, a breach.
- Bank fixed charge coverage: 1.09x against 1.10x, a breach.
- Bank days cash: about 24 days against 30, a breach.
- Lease rent coverage: 1.2x against 1.15x, a near miss.
- HUD debt service coverage passes, but its reporting is due 30 April.

Loan and lease numbers are in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells a setting, so the check refuses it.
