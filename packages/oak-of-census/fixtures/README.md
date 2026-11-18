# Fixtures

Fictional data only: Cedar Hollow Health and Rehab (a made-up 120-bed home), made-up residents, and made-up payers marked "(fictional)". Any likeness to real people is chance.

- `census-2026-02.csv`: census rows (PointClickCare-style headers, not checked against a real export).
- `billing-2026-02.csv`: billed claim lines for February 2026 with planted problems: unbilled days (R102), wrong payer (R103), hospital leave billed (R104), days after discharge (R105), a level mismatch (R106), overlapping census rows (R107), a duplicate line (R108) and a rate difference (R109).
- `rates.json`: example per-diem rates. Real rates come from the home's contracts and state notices.
