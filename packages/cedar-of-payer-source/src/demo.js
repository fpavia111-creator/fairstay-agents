import { runDemo } from 'evergreen-core';

const f = { census: 'census.csv', residents: 'residents.csv', rules: 'rules.json', month: '2026-03' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Cedar of Payer Source', [
  { label: 'Check the payer for every resident day in March 2026', tool: 'cedar_check', args: f, list: (i) => `${i.status.padEnd(25)} ${String(i.days).padStart(3)} day(s)  ${i.message}` },
  { label: 'Write the payer source work list', tool: 'cedar_write_report', args: f },
  { label: 'Teach another spelling of the Medicaid payer', tool: 'cedar_learn', args: { kind: 'payer_alias', value: { alias: 'LS Medicaid', payer: 'Lone Star Medicaid (fictional)' } } },
  { label: 'Agent tries to change the census itself', tool: 'census_update', args: {} },
]);
