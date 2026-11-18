import { runDemo } from 'evergreen-core';

const f = { t12: 't12.csv', census: 'census-months.csv', ar: 'ar-aging.csv', assumptions: 'assumptions.json' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Baobab of Underwriting', [
  { label: 'Underwrite the facility', tool: 'baobab_check', args: f, list: (i) => `${i.status.padEnd(26)} ${i.message}` },
  { label: 'Write the underwriting packet', tool: 'baobab_write_report', args: f },
  { label: 'Agent tries to send a letter of intent itself', tool: 'loi_send', args: {} },
]);
