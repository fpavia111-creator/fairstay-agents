# Fairstay (Fairstay)

*Von Claude übersetzt; Prüfung durch Muttersprachler steht aus. Die englische [README](README.md) ist maßgeblich.*

32 kleine MCP-Agenten für die Verwaltung von Pflegeheimen (Skilled Nursing) in den USA: Belegung, Abrechnung, Forderungen, Finanzen, Lohn und Eigentümerwechsel. Jeder Agent hat **eine Aufgabe**, liest die Dateien, die Ihre Systeme bereits exportieren, und schreibt Berichte und Entwürfe auf Ihrem Rechner.

MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · nur fiktive Testdaten

Einrichtung als Festpreis-Paket: [Fairstay](https://fair-agents.com/fairstay.html).

## Ausprobieren

```bash
npm install
npm test
node packages/fairstay-census-billing/bin/fairstay-census-billing.js demo
node packages/fairstay-acquisition-underwriting/bin/fairstay-acquisition-underwriting.js demo
```

Jeder Agent hat eine `demo` mit fiktiven Dateien, ein `eval` mit eigenen Testfällen und einen MCP-Server (`<agent> mcp --root <ordner>`).

## Die Agenten

**Abrechnung und Revenue Cycle:** [`fairstay-census-billing`](packages/fairstay-census-billing), [`fairstay-eligibility-checks`](packages/fairstay-eligibility-checks), [`fairstay-payer-source`](packages/fairstay-payer-source), [`fairstay-part-a-claims`](packages/fairstay-part-a-claims), [`fairstay-medicaid-pending`](packages/fairstay-medicaid-pending), [`fairstay-patient-liability`](packages/fairstay-patient-liability), [`fairstay-part-b-therapy`](packages/fairstay-part-b-therapy), [`fairstay-next-payer-planning`](packages/fairstay-next-payer-planning), [`fairstay-hospice-room-and-board`](packages/fairstay-hospice-room-and-board), [`fairstay-crossover-claims`](packages/fairstay-crossover-claims)

**Forderungen und Widersprüche:** [`fairstay-collections`](packages/fairstay-collections), [`fairstay-denial-appeals`](packages/fairstay-denial-appeals)

**Fallmanagement:** [`fairstay-managed-care-authorizations`](packages/fairstay-managed-care-authorizations), [`fairstay-length-of-stay`](packages/fairstay-length-of-stay)

**Managed Care:** [`fairstay-managed-care-claims`](packages/fairstay-managed-care-claims), [`fairstay-mco-contracts`](packages/fairstay-mco-contracts)

**Finanzen:** [`fairstay-payables-review`](packages/fairstay-payables-review), [`fairstay-bank-reconciliation`](packages/fairstay-bank-reconciliation), [`fairstay-13-week-cash-flow`](packages/fairstay-13-week-cash-flow), [`fairstay-borrowing-base`](packages/fairstay-borrowing-base), [`fairstay-covenant-tests`](packages/fairstay-covenant-tests), [`fairstay-month-end-close`](packages/fairstay-month-end-close), [`fairstay-cost-report`](packages/fairstay-cost-report), [`fairstay-ancillary-invoices`](packages/fairstay-ancillary-invoices), [`fairstay-vendor-contracts`](packages/fairstay-vendor-contracts), [`fairstay-propco-bookkeeping`](packages/fairstay-propco-bookkeeping)

**Lohn und Personal:** [`fairstay-payroll-audit`](packages/fairstay-payroll-audit), [`fairstay-staffing-and-pbj`](packages/fairstay-staffing-and-pbj), [`fairstay-payroll-accruals`](packages/fairstay-payroll-accruals)

**Eigentümerwechsel und Zulassungen:** [`fairstay-change-of-ownership`](packages/fairstay-change-of-ownership), [`fairstay-licensing-calendar`](packages/fairstay-licensing-calendar)

**Übernahmen und Underwriting:** [`fairstay-acquisition-underwriting`](packages/fairstay-acquisition-underwriting)

## Wie sie sicher bleiben

- **Nur lokale Dateien.** Keine Anmeldung bei Praxissoftware, Kostenträgerportalen, Banken oder Behörden; kein Netzwerk, keine Telemetrie.
- **Maskiert, bevor das Modell es sieht.** Namen von Patienten, Bewohnern und Personal werden zu Pseudonymen (`PT-3f9a1c2e`).
- **Menschen senden.** Einreichen, Zahlen, Melden und Versenden verweigert jeder Agent; Entwürfe warten auf den Klick einer namentlich genannten Person.
- **Einstellungen statt fester Regeln.** Sätze, Grenzen und Fristen sind JSON-Einstellungen, die Sie bestätigen.

## Grenzen

Keine Rechts-, Steuer-, Abrechnungs- oder medizinische Beratung. Maskierung ist eine Designentscheidung, keine HIPAA-Feststellung. Spaltennamen wurden noch nicht an echten Exporten geprüft; die erste Einrichtung bestätigt sie mit Ihnen. Dateien aus neun Sprachen werden gelesen (Kodierungen, Zahlen, Daten, Spaltennamen); Ergebnisse und CSV bleiben auf Englisch.

## Lizenz

MIT. Details in der englischen README.
