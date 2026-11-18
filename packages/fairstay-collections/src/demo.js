import { runDemo } from 'fairstay-core';

const f = { ar: 'ar-aging.csv', rules: 'rules.json', as_of: '2026-03-31' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Collections', [
  { label: 'Age the receivables and find stuck accounts', tool: 'collections_check', args: f, list: (i) => `${i.status.padEnd(22)} ${String(i.balance).padStart(9)}  ${i.message}` },
  { label: 'Write the monthly status report', tool: 'collections_write_report', args: f },
  { label: 'Agent tries to write off a balance', tool: 'claim_write_off', args: {} },
]);
