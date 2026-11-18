# Evergreen (Fairstay)

*Traducido por Claude; pendiente de revisión por un hablante nativo. El [README](README.md) en inglés es el que vale.*

32 pequeños agentes MCP para la administración de residencias de enfermería especializada en EE. UU.: censo, facturación, cobranza, finanzas, nómina y cambios de propietario. Cada agente tiene **una sola tarea**, lee los archivos que sus sistemas ya exportan y escribe informes y borradores en su computadora.

Licencia MIT · Node 20 o posterior · solo archivos locales · sin credenciales · solo datos de prueba ficticios

Instalación a precio fijo: [Fairstay](https://fair-agents.com/fairstay.html).

## Pruébelo

```bash
npm install
npm test
node packages/oak-of-census/bin/oak-of-census.js demo
node packages/baobab-of-underwriting/bin/baobab-of-underwriting.js demo
```

Cada agente tiene una `demo` con archivos ficticios, un `eval` con sus propios casos y un servidor MCP (`<agente> mcp --root <carpeta>`).

## Los agentes

**Facturación y ciclo de ingresos:** [`oak-of-census`](packages/oak-of-census), [`birch-of-eligibility`](packages/birch-of-eligibility), [`cedar-of-payer-source`](packages/cedar-of-payer-source), [`pine-of-part-a`](packages/pine-of-part-a), [`maple-of-medicaid-pending`](packages/maple-of-medicaid-pending), [`spruce-of-liability`](packages/spruce-of-liability), [`aspen-of-part-b`](packages/aspen-of-part-b), [`hemlock-of-next-payer`](packages/hemlock-of-next-payer), [`elm-of-hospice`](packages/elm-of-hospice), [`rowan-of-crossovers`](packages/rowan-of-crossovers)

**Cobranza y apelaciones:** [`alder-of-collections`](packages/alder-of-collections), [`larch-of-appeals`](packages/larch-of-appeals)

**Gestión de casos:** [`poplar-of-authorizations`](packages/poplar-of-authorizations), [`yew-of-length-of-stay`](packages/yew-of-length-of-stay)

**Atención gestionada (managed care):** [`willow-of-managed-care`](packages/willow-of-managed-care), [`mulberry-of-mco-contracts`](packages/mulberry-of-mco-contracts)

**Servicios financieros:** [`sequoia-of-payables`](packages/sequoia-of-payables), [`cypress-of-cash`](packages/cypress-of-cash), [`redwood-of-cashflow`](packages/redwood-of-cashflow), [`hazel-of-borrowing-base`](packages/hazel-of-borrowing-base), [`linden-of-covenants`](packages/linden-of-covenants), [`sycamore-of-close`](packages/sycamore-of-close), [`chestnut-of-cost-report`](packages/chestnut-of-cost-report), [`ash-of-ancillaries`](packages/ash-of-ancillaries), [`walnut-of-vendor-contracts`](packages/walnut-of-vendor-contracts), [`beech-of-propco`](packages/beech-of-propco)

**Nómina y personal:** [`holly-of-payroll`](packages/holly-of-payroll), [`magnolia-of-staffing`](packages/magnolia-of-staffing), [`acacia-of-accruals`](packages/acacia-of-accruals)

**Cambio de propietario y licencias:** [`olive-of-chow`](packages/olive-of-chow), [`fir-of-licensing`](packages/fir-of-licensing)

**Adquisiciones y suscripción:** [`baobab-of-underwriting`](packages/baobab-of-underwriting)

## Cómo se mantienen seguros

- **Solo archivos locales.** Sin inicio de sesión en el software de la consulta, portales de pagadores, bancos ni organismos; sin red ni telemetría.
- **Enmascarado antes de que lo vea el modelo.** Los nombres de pacientes, residentes y personal se convierten en seudónimos (`PT-3f9a1c2e`).
- **Las personas envían.** Cada agente se niega a presentar, pagar, declarar o enviar; los borradores esperan el clic de una persona con nombre.
- **Ajustes, no reglas fijas.** Tarifas, límites y plazos son ajustes JSON que usted confirma.

## Límites

No es asesoría legal, fiscal, de facturación ni médica. El enmascaramiento es una decisión de diseño, no una determinación de HIPAA. Los nombres de columna aún no se han comprobado con exportaciones reales; la primera instalación los confirma con usted. Se leen archivos de nueve idiomas (codificaciones, números, fechas, nombres de columna); los resultados y los CSV quedan en inglés.

## Licencia

MIT. Detalles en el README en inglés.
