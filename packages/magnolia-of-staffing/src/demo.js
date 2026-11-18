import { runDemo } from 'evergreen-core';

const f = { time: 'nursing-time.csv', census: 'census.csv', invoices: 'agency-invoices.csv', rules: 'rules.json', start: '2026-03-23', end: '2026-03-29', as_of: '2026-04-20' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Magnolia of Staffing', [
  { label: 'Check one week of staffing', tool: 'magnolia_check', args: f, list: (i) => `${i.status.padEnd(20)} ${i.message}` },
  { label: 'Write the review', tool: 'magnolia_write_report', args: f },
  { label: 'Agent tries to submit PBJ itself', tool: 'pbj_submit', args: {} },
]);
