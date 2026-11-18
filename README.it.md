# Evergreen (Fairstay)

*Tradotto da Claude; revisione di un madrelingua in attesa. Fa fede il [README](README.md) inglese.*

32 piccoli agenti MCP per il back-office delle strutture di assistenza infermieristica (skilled nursing) negli USA: censimento, fatturazione, incassi, finanza, paghe e cambi di proprietà. Ogni agente ha **un solo compito**, legge i file che i vostri sistemi già esportano e scrive report e bozze sul vostro computer.

Licenza MIT · Node 20 o successivo · solo file locali · nessuna credenziale · solo dati di prova fittizi

Installazione a prezzo fisso: [Fairstay](https://fair-agents.com/fairstay.html).

## Provatelo

```bash
npm install
npm test
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

Ogni agente ha una `demo` su file fittizi, un `eval` con i propri casi e un server MCP (`<agente> mcp --root <cartella>`).

## Gli agenti

**Fatturazione e ciclo dei ricavi:** [`oak-of-census`](packages/oak-of-census), [`birch-of-eligibility`](packages/birch-of-eligibility), [`cedar-of-payer-source`](packages/cedar-of-payer-source), [`pine-of-part-a`](packages/pine-of-part-a), [`maple-of-medicaid-pending`](packages/maple-of-medicaid-pending), [`spruce-of-liability`](packages/spruce-of-liability), [`aspen-of-part-b`](packages/aspen-of-part-b), [`hemlock-of-next-payer`](packages/hemlock-of-next-payer), [`elm-of-hospice`](packages/elm-of-hospice), [`rowan-of-crossovers`](packages/rowan-of-crossovers)

**Incassi e ricorsi:** [`alder-of-collections`](packages/alder-of-collections), [`larch-of-appeals`](packages/larch-of-appeals)

**Gestione dei casi:** [`poplar-of-authorizations`](packages/poplar-of-authorizations), [`yew-of-length-of-stay`](packages/yew-of-length-of-stay)

**Managed care:** [`willow-of-managed-care`](packages/willow-of-managed-care), [`mulberry-of-mco-contracts`](packages/mulberry-of-mco-contracts)

**Servizi finanziari:** [`sequoia-of-payables`](packages/sequoia-of-payables), [`cypress-of-cash`](packages/cypress-of-cash), [`redwood-of-cashflow`](packages/redwood-of-cashflow), [`hazel-of-borrowing-base`](packages/hazel-of-borrowing-base), [`linden-of-covenants`](packages/linden-of-covenants), [`sycamore-of-close`](packages/sycamore-of-close), [`chestnut-of-cost-report`](packages/chestnut-of-cost-report), [`ash-of-ancillaries`](packages/ash-of-ancillaries), [`walnut-of-vendor-contracts`](packages/walnut-of-vendor-contracts), [`beech-of-propco`](packages/beech-of-propco)

**Paghe e personale:** [`holly-of-payroll`](packages/holly-of-payroll), [`magnolia-of-staffing`](packages/magnolia-of-staffing), [`acacia-of-accruals`](packages/acacia-of-accruals)

**Cambio di proprietà e licenze:** [`olive-of-chow`](packages/olive-of-chow), [`fir-of-licensing`](packages/fir-of-licensing)

**Acquisizioni e underwriting:** [`baobab-of-underwriting`](packages/baobab-of-underwriting)

## Come restano sicuri

- **Solo file locali.** Nessun accesso al software dello studio, ai portali dei pagatori, alle banche o agli enti; niente rete, niente telemetria.
- **Mascherato prima che il modello lo veda.** I nomi di pazienti, ospiti e personale diventano pseudonimi (`PT-3f9a1c2e`).
- **Sono le persone a inviare.** Ogni agente rifiuta di presentare, pagare, dichiarare o inviare; le bozze aspettano il clic di una persona indicata per nome.
- **Impostazioni, non regole fisse.** Tariffe, limiti e scadenze sono impostazioni JSON che confermate voi.

## Limiti

Nessuna consulenza legale, fiscale, di fatturazione o medica. Il mascheramento è una scelta di progettazione, non una determinazione HIPAA. I nomi delle colonne non sono ancora stati verificati su esportazioni reali; la prima installazione li conferma con voi. Si leggono file in nove lingue (codifiche, numeri, date, nomi di colonna); risultati e CSV restano in inglese.

## Licenza

MIT. Dettagli nel README inglese.
