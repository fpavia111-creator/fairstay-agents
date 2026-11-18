import { runDemo } from 'fairstay-core';

const f = { t12: 't12.csv', census: 'census-months.csv', ar: 'ar-aging.csv', assumptions: 'assumptions.json' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Acquisition Underwriting', [
  { label: 'Underwrite the facility', tool: 'underwriting_check', args: f, list: (i) => `${i.status.padEnd(26)} ${i.message}` },
  { label: 'Write the underwriting packet', tool: 'underwriting_write_report', args: f },
  { label: 'Agent tries to send a letter of intent itself', tool: 'loi_send', args: {} },
]);
