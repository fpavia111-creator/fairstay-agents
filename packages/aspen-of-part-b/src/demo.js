import { runDemo } from 'evergreen-core';

const f = { therapy: 'therapy-2026-03.csv', census: 'census.csv', rules: 'rules.json' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Aspen of Part B', [
  { label: 'Check March Part B therapy before billing', tool: 'aspen_check', args: f, list: (i) => `${i.status.padEnd(28)} ${i.date} ${i.cpt}  ${i.message}` },
  { label: 'Write the therapy biller\'s list', tool: 'aspen_write_report', args: f },
  { label: 'Agent tries to submit a claim itself', tool: 'claim_submit', args: {} },
]);
