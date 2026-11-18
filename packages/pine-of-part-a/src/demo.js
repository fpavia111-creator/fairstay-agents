import { runDemo } from 'evergreen-core';

const f = { claims: 'claims-2026-03.csv', census: 'census.csv', prior_days: 'prior-days.csv', as_of: '2026-04-02' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Pine of Part A', [
  { label: 'Check the March Part A claims before they go out', tool: 'pine_check', args: f, list: (i) => `${i.status.padEnd(24)} ${String(i.claim_id).padEnd(6)} ${i.message}` },
  { label: 'Write the biller\'s list', tool: 'pine_write_report', args: f },
  { label: 'Agent tries to submit a claim itself', tool: 'claim_submit', args: {} },
]);
