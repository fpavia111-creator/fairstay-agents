# Fairstay (Fairstay)

*Tradotto da Claude; revisione di un madrelingua in attesa. Fa fede il [README](README.md) inglese.*

32 piccoli agenti MCP per il back-office delle strutture di assistenza infermieristica (skilled nursing) negli USA: censimento, fatturazione, incassi, finanza, paghe e cambi di proprietà. Ogni agente ha **un solo compito**, legge i file che i vostri sistemi già esportano e scrive report e bozze sul vostro computer.

Licenza MIT · Node 20 o successivo · solo file locali · nessuna credenziale · solo dati di prova fittizi

Installazione a prezzo fisso: [Fairstay](https://fair-agents.com/fairstay.html).

## Provatelo

```bash
npm install
npm test
node packages/fairstay-census-billing/bin/fairstay-census-billing.js demo
node packages/fairstay-acquisition-underwriting/bin/fairstay-acquisition-underwriting.js demo
```

Ogni agente ha una `demo` su file fittizi, un `eval` con i propri casi e un server MCP (`<agente> mcp --root <cartella>`).

## Gli agenti

**Fatturazione e ciclo dei ricavi:** [`fairstay-census-billing`](packages/fairstay-census-billing), [`fairstay-eligibility-checks`](packages/fairstay-eligibility-checks), [`fairstay-payer-source`](packages/fairstay-payer-source), [`fairstay-part-a-claims`](packages/fairstay-part-a-claims), [`fairstay-medicaid-pending`](packages/fairstay-medicaid-pending), [`fairstay-patient-liability`](packages/fairstay-patient-liability), [`fairstay-part-b-therapy`](packages/fairstay-part-b-therapy), [`fairstay-next-payer-planning`](packages/fairstay-next-payer-planning), [`fairstay-hospice-room-and-board`](packages/fairstay-hospice-room-and-board), [`fairstay-crossover-claims`](packages/fairstay-crossover-claims)

**Incassi e ricorsi:** [`fairstay-collections`](packages/fairstay-collections), [`fairstay-denial-appeals`](packages/fairstay-denial-appeals)

**Gestione dei casi:** [`fairstay-managed-care-authorizations`](packages/fairstay-managed-care-authorizations), [`fairstay-length-of-stay`](packages/fairstay-length-of-stay)

**Managed care:** [`fairstay-managed-care-claims`](packages/fairstay-managed-care-claims), [`fairstay-mco-contracts`](packages/fairstay-mco-contracts)

**Servizi finanziari:** [`fairstay-payables-review`](packages/fairstay-payables-review), [`fairstay-bank-reconciliation`](packages/fairstay-bank-reconciliation), [`fairstay-13-week-cash-flow`](packages/fairstay-13-week-cash-flow), [`fairstay-borrowing-base`](packages/fairstay-borrowing-base), [`fairstay-covenant-tests`](packages/fairstay-covenant-tests), [`fairstay-month-end-close`](packages/fairstay-month-end-close), [`fairstay-cost-report`](packages/fairstay-cost-report), [`fairstay-ancillary-invoices`](packages/fairstay-ancillary-invoices), [`fairstay-vendor-contracts`](packages/fairstay-vendor-contracts), [`fairstay-propco-bookkeeping`](packages/fairstay-propco-bookkeeping)

**Paghe e personale:** [`fairstay-payroll-audit`](packages/fairstay-payroll-audit), [`fairstay-staffing-and-pbj`](packages/fairstay-staffing-and-pbj), [`fairstay-payroll-accruals`](packages/fairstay-payroll-accruals)

**Cambio di proprietà e licenze:** [`fairstay-change-of-ownership`](packages/fairstay-change-of-ownership), [`fairstay-licensing-calendar`](packages/fairstay-licensing-calendar)

**Acquisizioni e underwriting:** [`fairstay-acquisition-underwriting`](packages/fairstay-acquisition-underwriting)

## Come restano sicuri

- **Solo file locali.** Nessun accesso al software dello studio, ai portali dei pagatori, alle banche o agli enti; niente rete, niente telemetria.
- **Mascherato prima che il modello lo veda.** I nomi di pazienti, ospiti e personale diventano pseudonimi (`PT-3f9a1c2e`).
- **Sono le persone a inviare.** Ogni agente rifiuta di presentare, pagare, dichiarare o inviare; le bozze aspettano il clic di una persona indicata per nome.
- **Impostazioni, non regole fisse.** Tariffe, limiti e scadenze sono impostazioni JSON che confermate voi.

## Limiti

Nessuna consulenza legale, fiscale, di fatturazione o medica. Il mascheramento è una scelta di progettazione, non una determinazione HIPAA. I nomi delle colonne non sono ancora stati verificati su esportazioni reali; la prima installazione li conferma con voi. Si leggono file in nove lingue (codifiche, numeri, date, nomi di colonna); risultati e CSV restano in inglese.

## Licenza

MIT. Dettagli nel README inglese.
