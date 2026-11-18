# Fairstay (Fairstay)

*Traduzido por Claude; revisão por falante nativo pendente. O [README](README.md) em inglês é o que vale.*

32 pequenos agentes MCP para o back-office de casas de repouso com enfermagem especializada nos EUA: censo, faturamento, cobrança, finanças, folha de pagamento e mudanças de propriedade. Cada agente tem **uma única tarefa**, lê os arquivos que seus sistemas já exportam e escreve relatórios e rascunhos no seu computador.

Licença MIT · Node 20 ou mais recente · apenas arquivos locais · sem credenciais · apenas dados de teste fictícios

Implantação com preço fixo: [Fairstay](https://fair-agents.com/fairstay.html).

## Experimente

```bash
npm install
npm test
node packages/fairstay-census-billing/bin/fairstay-census-billing.js demo
node packages/fairstay-acquisition-underwriting/bin/fairstay-acquisition-underwriting.js demo
```

Cada agente tem uma `demo` com arquivos fictícios, um `eval` com seus próprios casos e um servidor MCP (`<agente> mcp --root <pasta>`).

## Os agentes

**Faturamento e ciclo de receita:** [`fairstay-census-billing`](packages/fairstay-census-billing), [`fairstay-eligibility-checks`](packages/fairstay-eligibility-checks), [`fairstay-payer-source`](packages/fairstay-payer-source), [`fairstay-part-a-claims`](packages/fairstay-part-a-claims), [`fairstay-medicaid-pending`](packages/fairstay-medicaid-pending), [`fairstay-patient-liability`](packages/fairstay-patient-liability), [`fairstay-part-b-therapy`](packages/fairstay-part-b-therapy), [`fairstay-next-payer-planning`](packages/fairstay-next-payer-planning), [`fairstay-hospice-room-and-board`](packages/fairstay-hospice-room-and-board), [`fairstay-crossover-claims`](packages/fairstay-crossover-claims)

**Cobrança e recursos:** [`fairstay-collections`](packages/fairstay-collections), [`fairstay-denial-appeals`](packages/fairstay-denial-appeals)

**Gestão de casos:** [`fairstay-managed-care-authorizations`](packages/fairstay-managed-care-authorizations), [`fairstay-length-of-stay`](packages/fairstay-length-of-stay)

**Planos gerenciados (managed care):** [`fairstay-managed-care-claims`](packages/fairstay-managed-care-claims), [`fairstay-mco-contracts`](packages/fairstay-mco-contracts)

**Serviços financeiros:** [`fairstay-payables-review`](packages/fairstay-payables-review), [`fairstay-bank-reconciliation`](packages/fairstay-bank-reconciliation), [`fairstay-13-week-cash-flow`](packages/fairstay-13-week-cash-flow), [`fairstay-borrowing-base`](packages/fairstay-borrowing-base), [`fairstay-covenant-tests`](packages/fairstay-covenant-tests), [`fairstay-month-end-close`](packages/fairstay-month-end-close), [`fairstay-cost-report`](packages/fairstay-cost-report), [`fairstay-ancillary-invoices`](packages/fairstay-ancillary-invoices), [`fairstay-vendor-contracts`](packages/fairstay-vendor-contracts), [`fairstay-propco-bookkeeping`](packages/fairstay-propco-bookkeeping)

**Folha de pagamento e equipe:** [`fairstay-payroll-audit`](packages/fairstay-payroll-audit), [`fairstay-staffing-and-pbj`](packages/fairstay-staffing-and-pbj), [`fairstay-payroll-accruals`](packages/fairstay-payroll-accruals)

**Mudança de propriedade e licenças:** [`fairstay-change-of-ownership`](packages/fairstay-change-of-ownership), [`fairstay-licensing-calendar`](packages/fairstay-licensing-calendar)

**Aquisições e subscrição:** [`fairstay-acquisition-underwriting`](packages/fairstay-acquisition-underwriting)

## Como eles se mantêm seguros

- **Apenas arquivos locais.** Sem login no software da clínica, em portais de operadoras, bancos ou órgãos; sem rede, sem telemetria.
- **Mascarado antes de o modelo ver.** Nomes de pacientes, residentes e funcionários viram pseudônimos (`PT-3f9a1c2e`).
- **Pessoas enviam.** Cada agente recusa enviar, pagar, declarar ou protocolar; os rascunhos esperam o clique de uma pessoa nomeada.
- **Configurações, não regras fixas.** Tarifas, limites e prazos são configurações JSON que você confirma.

## Limites

Não é aconselhamento jurídico, fiscal, de faturamento ou médico. O mascaramento é uma escolha de projeto, não uma determinação da HIPAA. Os nomes de colunas ainda não foram verificados em exportações reais; a primeira implantação os confirma com você. Arquivos de nove idiomas são lidos (codificações, números, datas, nomes de colunas); resultados e CSV ficam em inglês.

## Licença

MIT. Detalhes no README em inglês.
