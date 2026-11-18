import { runDemo } from 'evergreen-core';

const f = { census: 'census.csv', plans: 'plans.csv', rules: 'rules.json', as_of: '2026-03-10' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Hemlock of Next Payer', [
  { label: 'Plan next payers for the next 30 days', tool: 'hemlock_check', args: f, list: (i) => `${i.status.padEnd(15)} ${i.runs_out_on}  ${i.message}` },
  { label: 'Write the weekly planning list', tool: 'hemlock_write_report', args: f },
  { label: 'Agent tries to write to a family itself', tool: 'family_letter_send', args: {} },
]);
