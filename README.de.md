# Evergreen (Fairstay)

*Von Claude übersetzt; Prüfung durch Muttersprachler steht aus. Die englische [README](README.md) ist maßgeblich.*

32 kleine MCP-Agenten für die Verwaltung von Pflegeheimen (Skilled Nursing) in den USA: Belegung, Abrechnung, Forderungen, Finanzen, Lohn und Eigentümerwechsel. Jeder Agent hat **eine Aufgabe**, liest die Dateien, die Ihre Systeme bereits exportieren, und schreibt Berichte und Entwürfe auf Ihrem Rechner.

MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · nur fiktive Testdaten

Einrichtung als Festpreis-Paket: [Fairstay](https://fair-agents.com/fairstay.html).

## Ausprobieren

```bash
npm install
npm test
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

Jeder Agent hat eine `demo` mit fiktiven Dateien, ein `eval` mit eigenen Testfällen und einen MCP-Server (`<agent> mcp --root <ordner>`).

## Die Agenten

**Abrechnung und Revenue Cycle:** [`oak-of-census`](packages/oak-of-census), [`birch-of-eligibility`](packages/birch-of-eligibility), [`cedar-of-payer-source`](packages/cedar-of-payer-source), [`pine-of-part-a`](packages/pine-of-part-a), [`maple-of-medicaid-pending`](packages/maple-of-medicaid-pending), [`spruce-of-liability`](packages/spruce-of-liability), [`aspen-of-part-b`](packages/aspen-of-part-b), [`hemlock-of-next-payer`](packages/hemlock-of-next-payer), [`elm-of-hospice`](packages/elm-of-hospice), [`rowan-of-crossovers`](packages/rowan-of-crossovers)

**Forderungen und Widersprüche:** [`alder-of-collections`](packages/alder-of-collections), [`larch-of-appeals`](packages/larch-of-appeals)

**Fallmanagement:** [`poplar-of-authorizations`](packages/poplar-of-authorizations), [`yew-of-length-of-stay`](packages/yew-of-length-of-stay)

**Managed Care:** [`willow-of-managed-care`](packages/willow-of-managed-care), [`mulberry-of-mco-contracts`](packages/mulberry-of-mco-contracts)

**Finanzen:** [`sequoia-of-payables`](packages/sequoia-of-payables), [`cypress-of-cash`](packages/cypress-of-cash), [`redwood-of-cashflow`](packages/redwood-of-cashflow), [`hazel-of-borrowing-base`](packages/hazel-of-borrowing-base), [`linden-of-covenants`](packages/linden-of-covenants), [`sycamore-of-close`](packages/sycamore-of-close), [`chestnut-of-cost-report`](packages/chestnut-of-cost-report), [`ash-of-ancillaries`](packages/ash-of-ancillaries), [`walnut-of-vendor-contracts`](packages/walnut-of-vendor-contracts), [`beech-of-propco`](packages/beech-of-propco)

**Lohn und Personal:** [`holly-of-payroll`](packages/holly-of-payroll), [`magnolia-of-staffing`](packages/magnolia-of-staffing), [`acacia-of-accruals`](packages/acacia-of-accruals)

**Eigentümerwechsel und Zulassungen:** [`olive-of-chow`](packages/olive-of-chow), [`fir-of-licensing`](packages/fir-of-licensing)

**Übernahmen und Underwriting:** [`baobab-of-underwriting`](packages/baobab-of-underwriting)

## Wie sie sicher bleiben

- **Nur lokale Dateien.** Keine Anmeldung bei Praxissoftware, Kostenträgerportalen, Banken oder Behörden; kein Netzwerk, keine Telemetrie.
- **Maskiert, bevor das Modell es sieht.** Namen von Patienten, Bewohnern und Personal werden zu Pseudonymen (`PT-3f9a1c2e`).
- **Menschen senden.** Einreichen, Zahlen, Melden und Versenden verweigert jeder Agent; Entwürfe warten auf den Klick einer namentlich genannten Person.
- **Einstellungen statt fester Regeln.** Sätze, Grenzen und Fristen sind JSON-Einstellungen, die Sie bestätigen.

## Grenzen

Keine Rechts-, Steuer-, Abrechnungs- oder medizinische Beratung. Maskierung ist eine Designentscheidung, keine HIPAA-Feststellung. Spaltennamen wurden noch nicht an echten Exporten geprüft; die erste Einrichtung bestätigt sie mit Ihnen. Dateien aus neun Sprachen werden gelesen (Kodierungen, Zahlen, Daten, Spaltennamen); Ergebnisse und CSV bleiben auf Englisch.

## Lizenz

MIT. Details in der englischen README.
