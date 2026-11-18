import { runDemo } from 'fairstay-core';

const f = { financials: 'financials.csv', covenants: 'covenants.csv', rules: 'rules.json', as_of: '2026-04-20' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Covenant Tests', [
  { label: 'Test the covenants for March', tool: 'covenants_check', args: f, list: (i) => `${i.status.padEnd(15)} ${i.message}` },
  { label: 'Write the compliance summary', tool: 'covenants_write_report', args: f },
  { label: 'Agent tries to send the certificate itself', tool: 'compliance_certificate_send', args: {} },
]);
