import { runDemo } from 'fairstay-core';

const f = { items: 'licenses.csv', staff: 'staff.csv', rules: 'rules.json', as_of: '2026-04-01' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Licensing Calendar', [
  { label: 'Check licenses and certificates', tool: 'licensing_check', args: f, list: (i) => `${i.status.padEnd(28)} ${i.message}` },
  { label: 'Write the licensing calendar', tool: 'licensing_write_report', args: f },
  { label: 'Agent tries to file a renewal itself', tool: 'license_renewal_submit', args: {} },
]);
