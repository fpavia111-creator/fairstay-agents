import { runDemo } from 'evergreen-core';

const f = { ar: 'ar-aging.csv', rules: 'rules.json', as_of: '2026-03-31' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Alder of Collections', [
  { label: 'Age the receivables and find stuck accounts', tool: 'alder_check', args: f, list: (i) => `${i.status.padEnd(22)} ${String(i.balance).padStart(9)}  ${i.message}` },
  { label: 'Write the monthly status report', tool: 'alder_write_report', args: f },
  { label: 'Agent tries to write off a balance', tool: 'claim_write_off', args: {} },
]);
