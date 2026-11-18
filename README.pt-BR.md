# Evergreen (Fairstay)

*Traduzido por Claude; revisão por falante nativo pendente. O [README](README.md) em inglês é o que vale.*

32 pequenos agentes MCP para o back-office de casas de repouso com enfermagem especializada nos EUA: censo, faturamento, cobrança, finanças, folha de pagamento e mudanças de propriedade. Cada agente tem **uma única tarefa**, lê os arquivos que seus sistemas já exportam e escreve relatórios e rascunhos no seu computador.

Licença MIT · Node 20 ou mais recente · apenas arquivos locais · sem credenciais · apenas dados de teste fictícios

Implantação com preço fixo: [Fairstay](https://fair-agents.com/fairstay.html).

## Experimente

```bash
npm install
npm test
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

Cada agente tem uma `demo` com arquivos fictícios, um `eval` com seus próprios casos e um servidor MCP (`<agente> mcp --root <pasta>`).

## Os agentes

**Faturamento e ciclo de receita:** [`oak-of-census`](packages/oak-of-census), [`birch-of-eligibility`](packages/birch-of-eligibility), [`cedar-of-payer-source`](packages/cedar-of-payer-source), [`pine-of-part-a`](packages/pine-of-part-a), [`maple-of-medicaid-pending`](packages/maple-of-medicaid-pending), [`spruce-of-liability`](packages/spruce-of-liability), [`aspen-of-part-b`](packages/aspen-of-part-b), [`hemlock-of-next-payer`](packages/hemlock-of-next-payer), [`elm-of-hospice`](packages/elm-of-hospice), [`rowan-of-crossovers`](packages/rowan-of-crossovers)

**Cobrança e recursos:** [`alder-of-collections`](packages/alder-of-collections), [`larch-of-appeals`](packages/larch-of-appeals)

**Gestão de casos:** [`poplar-of-authorizations`](packages/poplar-of-authorizations), [`yew-of-length-of-stay`](packages/yew-of-length-of-stay)

**Planos gerenciados (managed care):** [`willow-of-managed-care`](packages/willow-of-managed-care), [`mulberry-of-mco-contracts`](packages/mulberry-of-mco-contracts)

**Serviços financeiros:** [`sequoia-of-payables`](packages/sequoia-of-payables), [`cypress-of-cash`](packages/cypress-of-cash), [`redwood-of-cashflow`](packages/redwood-of-cashflow), [`hazel-of-borrowing-base`](packages/hazel-of-borrowing-base), [`linden-of-covenants`](packages/linden-of-covenants), [`sycamore-of-close`](packages/sycamore-of-close), [`chestnut-of-cost-report`](packages/chestnut-of-cost-report), [`ash-of-ancillaries`](packages/ash-of-ancillaries), [`walnut-of-vendor-contracts`](packages/walnut-of-vendor-contracts), [`beech-of-propco`](packages/beech-of-propco)

**Folha de pagamento e equipe:** [`holly-of-payroll`](packages/holly-of-payroll), [`magnolia-of-staffing`](packages/magnolia-of-staffing), [`acacia-of-accruals`](packages/acacia-of-accruals)

**Mudança de propriedade e licenças:** [`olive-of-chow`](packages/olive-of-chow), [`fir-of-licensing`](packages/fir-of-licensing)

**Aquisições e subscrição:** [`baobab-of-underwriting`](packages/baobab-of-underwriting)

## Como eles se mantêm seguros

- **Apenas arquivos locais.** Sem login no software da clínica, em portais de operadoras, bancos ou órgãos; sem rede, sem telemetria.
- **Mascarado antes de o modelo ver.** Nomes de pacientes, residentes e funcionários viram pseudônimos (`PT-3f9a1c2e`).
- **Pessoas enviam.** Cada agente recusa enviar, pagar, declarar ou protocolar; os rascunhos esperam o clique de uma pessoa nomeada.
- **Configurações, não regras fixas.** Tarifas, limites e prazos são configurações JSON que você confirma.

## Limites

Não é aconselhamento jurídico, fiscal, de faturamento ou médico. O mascaramento é uma escolha de projeto, não uma determinação da HIPAA. Os nomes de colunas ainda não foram verificados em exportações reais; a primeira implantação os confirma com você. Arquivos de nove idiomas são lidos (codificações, números, datas, nomes de colunas); resultados e CSV ficam em inglês.

## Licença

MIT. Detalhes no README em inglês.
