# Fairstay (Fairstay)

*Traduit par Claude ; relecture par un locuteur natif en attente. Le [README](README.md) anglais fait foi.*

32 petits agents MCP pour le back-office des maisons de soins infirmiers (skilled nursing) aux États-Unis : recensement, facturation, recouvrement, finances, paie et changements de propriétaire. Chaque agent a **une seule tâche**, lit les fichiers que vos systèmes exportent déjà et écrit des rapports et des brouillons sur votre ordinateur.

Licence MIT · Node 20 ou plus récent · fichiers locaux uniquement · aucun identifiant · données de test fictives

Mise en place à prix fixe : [Fairstay](https://fair-agents.com/fairstay.html).

## Essayer

```bash
npm install
npm test
node packages/fairstay-census-billing/bin/fairstay-census-billing.js demo
node packages/fairstay-acquisition-underwriting/bin/fairstay-acquisition-underwriting.js demo
```

Chaque agent a une `demo` sur des fichiers fictifs, un `eval` avec ses propres cas et un serveur MCP (`<agent> mcp --root <dossier>`).

## Les agents

**Facturation et cycle de revenus:** [`fairstay-census-billing`](packages/fairstay-census-billing), [`fairstay-eligibility-checks`](packages/fairstay-eligibility-checks), [`fairstay-payer-source`](packages/fairstay-payer-source), [`fairstay-part-a-claims`](packages/fairstay-part-a-claims), [`fairstay-medicaid-pending`](packages/fairstay-medicaid-pending), [`fairstay-patient-liability`](packages/fairstay-patient-liability), [`fairstay-part-b-therapy`](packages/fairstay-part-b-therapy), [`fairstay-next-payer-planning`](packages/fairstay-next-payer-planning), [`fairstay-hospice-room-and-board`](packages/fairstay-hospice-room-and-board), [`fairstay-crossover-claims`](packages/fairstay-crossover-claims)

**Recouvrement et recours:** [`fairstay-collections`](packages/fairstay-collections), [`fairstay-denial-appeals`](packages/fairstay-denial-appeals)

**Gestion des cas:** [`fairstay-managed-care-authorizations`](packages/fairstay-managed-care-authorizations), [`fairstay-length-of-stay`](packages/fairstay-length-of-stay)

**Soins gérés (managed care):** [`fairstay-managed-care-claims`](packages/fairstay-managed-care-claims), [`fairstay-mco-contracts`](packages/fairstay-mco-contracts)

**Services financiers:** [`fairstay-payables-review`](packages/fairstay-payables-review), [`fairstay-bank-reconciliation`](packages/fairstay-bank-reconciliation), [`fairstay-13-week-cash-flow`](packages/fairstay-13-week-cash-flow), [`fairstay-borrowing-base`](packages/fairstay-borrowing-base), [`fairstay-covenant-tests`](packages/fairstay-covenant-tests), [`fairstay-month-end-close`](packages/fairstay-month-end-close), [`fairstay-cost-report`](packages/fairstay-cost-report), [`fairstay-ancillary-invoices`](packages/fairstay-ancillary-invoices), [`fairstay-vendor-contracts`](packages/fairstay-vendor-contracts), [`fairstay-propco-bookkeeping`](packages/fairstay-propco-bookkeeping)

**Paie et effectifs:** [`fairstay-payroll-audit`](packages/fairstay-payroll-audit), [`fairstay-staffing-and-pbj`](packages/fairstay-staffing-and-pbj), [`fairstay-payroll-accruals`](packages/fairstay-payroll-accruals)

**Changement de propriétaire et licences:** [`fairstay-change-of-ownership`](packages/fairstay-change-of-ownership), [`fairstay-licensing-calendar`](packages/fairstay-licensing-calendar)

**Acquisitions et underwriting:** [`fairstay-acquisition-underwriting`](packages/fairstay-acquisition-underwriting)

## Comment ils restent sûrs

- **Fichiers locaux uniquement.** Aucune connexion au logiciel du cabinet, aux portails des payeurs, aux banques ou aux administrations ; pas de réseau, pas de télémétrie.
- **Masqué avant que le modèle ne le voie.** Les noms des patients, résidents et employés deviennent des pseudonymes (`PT-3f9a1c2e`).
- **Ce sont les personnes qui envoient.** Chaque agent refuse de soumettre, payer, déclarer ou envoyer ; les brouillons attendent le clic d'une personne nommée.
- **Des réglages, pas des règles figées.** Tarifs, limites et délais sont des réglages JSON que vous confirmez.

## Limites

Aucun conseil juridique, fiscal, de facturation ou médical. Le masquage est un choix de conception, pas une détermination HIPAA. Les noms de colonnes n'ont pas encore été vérifiés sur de vrais exports ; la première mise en place les confirme avec vous. Les fichiers de neuf langues sont lus (encodages, nombres, dates, noms de colonnes) ; les résultats et les CSV restent en anglais.

## Licence

MIT. Détails dans le README anglais.
