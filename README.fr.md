# Evergreen (Fairstay)

*Traduit par Claude ; relecture par un locuteur natif en attente. Le [README](README.md) anglais fait foi.*

32 petits agents MCP pour le back-office des maisons de soins infirmiers (skilled nursing) aux États-Unis : recensement, facturation, recouvrement, finances, paie et changements de propriétaire. Chaque agent a **une seule tâche**, lit les fichiers que vos systèmes exportent déjà et écrit des rapports et des brouillons sur votre ordinateur.

Licence MIT · Node 20 ou plus récent · fichiers locaux uniquement · aucun identifiant · données de test fictives

Mise en place à prix fixe : [Fairstay](https://fair-agents.com/fairstay.html).

## Essayer

```bash
npm install
npm test
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

Chaque agent a une `demo` sur des fichiers fictifs, un `eval` avec ses propres cas et un serveur MCP (`<agent> mcp --root <dossier>`).

## Les agents

**Facturation et cycle de revenus:** [`oak-of-census`](packages/oak-of-census), [`birch-of-eligibility`](packages/birch-of-eligibility), [`cedar-of-payer-source`](packages/cedar-of-payer-source), [`pine-of-part-a`](packages/pine-of-part-a), [`maple-of-medicaid-pending`](packages/maple-of-medicaid-pending), [`spruce-of-liability`](packages/spruce-of-liability), [`aspen-of-part-b`](packages/aspen-of-part-b), [`hemlock-of-next-payer`](packages/hemlock-of-next-payer), [`elm-of-hospice`](packages/elm-of-hospice), [`rowan-of-crossovers`](packages/rowan-of-crossovers)

**Recouvrement et recours:** [`alder-of-collections`](packages/alder-of-collections), [`larch-of-appeals`](packages/larch-of-appeals)

**Gestion des cas:** [`poplar-of-authorizations`](packages/poplar-of-authorizations), [`yew-of-length-of-stay`](packages/yew-of-length-of-stay)

**Soins gérés (managed care):** [`willow-of-managed-care`](packages/willow-of-managed-care), [`mulberry-of-mco-contracts`](packages/mulberry-of-mco-contracts)

**Services financiers:** [`sequoia-of-payables`](packages/sequoia-of-payables), [`cypress-of-cash`](packages/cypress-of-cash), [`redwood-of-cashflow`](packages/redwood-of-cashflow), [`hazel-of-borrowing-base`](packages/hazel-of-borrowing-base), [`linden-of-covenants`](packages/linden-of-covenants), [`sycamore-of-close`](packages/sycamore-of-close), [`chestnut-of-cost-report`](packages/chestnut-of-cost-report), [`ash-of-ancillaries`](packages/ash-of-ancillaries), [`walnut-of-vendor-contracts`](packages/walnut-of-vendor-contracts), [`beech-of-propco`](packages/beech-of-propco)

**Paie et effectifs:** [`holly-of-payroll`](packages/holly-of-payroll), [`magnolia-of-staffing`](packages/magnolia-of-staffing), [`acacia-of-accruals`](packages/acacia-of-accruals)

**Changement de propriétaire et licences:** [`olive-of-chow`](packages/olive-of-chow), [`fir-of-licensing`](packages/fir-of-licensing)

**Acquisitions et underwriting:** [`baobab-of-underwriting`](packages/baobab-of-underwriting)

## Comment ils restent sûrs

- **Fichiers locaux uniquement.** Aucune connexion au logiciel du cabinet, aux portails des payeurs, aux banques ou aux administrations ; pas de réseau, pas de télémétrie.
- **Masqué avant que le modèle ne le voie.** Les noms des patients, résidents et employés deviennent des pseudonymes (`PT-3f9a1c2e`).
- **Ce sont les personnes qui envoient.** Chaque agent refuse de soumettre, payer, déclarer ou envoyer ; les brouillons attendent le clic d'une personne nommée.
- **Des réglages, pas des règles figées.** Tarifs, limites et délais sont des réglages JSON que vous confirmez.

## Limites

Aucun conseil juridique, fiscal, de facturation ou médical. Le masquage est un choix de conception, pas une détermination HIPAA. Les noms de colonnes n'ont pas encore été vérifiés sur de vrais exports ; la première mise en place les confirme avec vous. Les fichiers de neuf langues sont lus (encodages, nombres, dates, noms de colonnes) ; les résultats et les CSV restent en anglais.

## Licence

MIT. Détails dans le README anglais.
