# Fixtures

Fictional managed care contracts for Cedar Hollow, reviewed on 1 April 2026. Planted:

- Lone Star Health Advantage paid 14 Level 3 days at 650 a day against a 700 contract rate (700 short).
- The Prairie Star Plus Medicaid managed care contract ended 28 February 2026 and does not renew on its own.
- Hill Country Health paid a claim and has no contract on file.
- Gulf Coast HMO renews on 30 June unless notice is given by 1 May. Its Level 1 and Level 2 rates are 45 and 60 a day below the benchmark and have not changed since July 2023.
- Bluebonnet Care Plan paid exactly its contract rate.

Resident names and claim numbers are in `phi-canaries.json`; they must never reach the model. `rules-typo.json` misspells `benchmarks`, so the check refuses it.
