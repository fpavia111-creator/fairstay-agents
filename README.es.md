# Fairstay (Fairstay)

*Traducido por Claude; pendiente de revisión por un hablante nativo. El [README](README.md) en inglés es el que vale.*

32 pequeños agentes MCP para la administración de residencias de enfermería especializada en EE. UU.: censo, facturación, cobranza, finanzas, nómina y cambios de propietario. Cada agente tiene **una sola tarea**, lee los archivos que sus sistemas ya exportan y escribe informes y borradores en su computadora.

Licencia MIT · Node 20 o posterior · solo archivos locales · sin credenciales · solo datos de prueba ficticios

Instalación a precio fijo: [Fairstay](https://fair-agents.com/fairstay.html).

## Pruébelo

```bash
npm install
npm test
node packages/fairstay-census-billing/bin/fairstay-census-billing.js demo
node packages/fairstay-acquisition-underwriting/bin/fairstay-acquisition-underwriting.js demo
```

Cada agente tiene una `demo` con archivos ficticios, un `eval` con sus propios casos y un servidor MCP (`<agente> mcp --root <carpeta>`).

## Los agentes

**Facturación y ciclo de ingresos:** [`fairstay-census-billing`](packages/fairstay-census-billing), [`fairstay-eligibility-checks`](packages/fairstay-eligibility-checks), [`fairstay-payer-source`](packages/fairstay-payer-source), [`fairstay-part-a-claims`](packages/fairstay-part-a-claims), [`fairstay-medicaid-pending`](packages/fairstay-medicaid-pending), [`fairstay-patient-liability`](packages/fairstay-patient-liability), [`fairstay-part-b-therapy`](packages/fairstay-part-b-therapy), [`fairstay-next-payer-planning`](packages/fairstay-next-payer-planning), [`fairstay-hospice-room-and-board`](packages/fairstay-hospice-room-and-board), [`fairstay-crossover-claims`](packages/fairstay-crossover-claims)

**Cobranza y apelaciones:** [`fairstay-collections`](packages/fairstay-collections), [`fairstay-denial-appeals`](packages/fairstay-denial-appeals)

**Gestión de casos:** [`fairstay-managed-care-authorizations`](packages/fairstay-managed-care-authorizations), [`fairstay-length-of-stay`](packages/fairstay-length-of-stay)

**Atención gestionada (managed care):** [`fairstay-managed-care-claims`](packages/fairstay-managed-care-claims), [`fairstay-mco-contracts`](packages/fairstay-mco-contracts)

**Servicios financieros:** [`fairstay-payables-review`](packages/fairstay-payables-review), [`fairstay-bank-reconciliation`](packages/fairstay-bank-reconciliation), [`fairstay-13-week-cash-flow`](packages/fairstay-13-week-cash-flow), [`fairstay-borrowing-base`](packages/fairstay-borrowing-base), [`fairstay-covenant-tests`](packages/fairstay-covenant-tests), [`fairstay-month-end-close`](packages/fairstay-month-end-close), [`fairstay-cost-report`](packages/fairstay-cost-report), [`fairstay-ancillary-invoices`](packages/fairstay-ancillary-invoices), [`fairstay-vendor-contracts`](packages/fairstay-vendor-contracts), [`fairstay-propco-bookkeeping`](packages/fairstay-propco-bookkeeping)

**Nómina y personal:** [`fairstay-payroll-audit`](packages/fairstay-payroll-audit), [`fairstay-staffing-and-pbj`](packages/fairstay-staffing-and-pbj), [`fairstay-payroll-accruals`](packages/fairstay-payroll-accruals)

**Cambio de propietario y licencias:** [`fairstay-change-of-ownership`](packages/fairstay-change-of-ownership), [`fairstay-licensing-calendar`](packages/fairstay-licensing-calendar)

**Adquisiciones y suscripción:** [`fairstay-acquisition-underwriting`](packages/fairstay-acquisition-underwriting)

## Cómo se mantienen seguros

- **Solo archivos locales.** Sin inicio de sesión en el software de la consulta, portales de pagadores, bancos ni organismos; sin red ni telemetría.
- **Enmascarado antes de que lo vea el modelo.** Los nombres de pacientes, residentes y personal se convierten en seudónimos (`PT-3f9a1c2e`).
- **Las personas envían.** Cada agente se niega a presentar, pagar, declarar o enviar; los borradores esperan el clic de una persona con nombre.
- **Ajustes, no reglas fijas.** Tarifas, límites y plazos son ajustes JSON que usted confirma.

## Límites

No es asesoría legal, fiscal, de facturación ni médica. El enmascaramiento es una decisión de diseño, no una determinación de HIPAA. Los nombres de columna aún no se han comprobado con exportaciones reales; la primera instalación los confirma con usted. Se leen archivos de nueve idiomas (codificaciones, números, fechas, nombres de columna); los resultados y los CSV quedan en inglés.

## Licencia

MIT. Detalles en el README en inglés.
