import { runDemo } from 'evergreen-core';

const f = { invoices: 'invoices.csv', vendors: 'vendors.csv', pos: 'pos.csv', rules: 'rules.json', as_of: '2026-03-31' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Sequoia of Payables', [
  { label: 'Review payables before the check run', tool: 'sequoia_check', args: f, list: (i) => `${i.status.padEnd(22)} ${String(i.amount).padStart(9)}  ${i.vendor}: ${i.message}` },
  { label: 'Write the review', tool: 'sequoia_write_report', args: f },
  { label: 'Agent tries to release a payment itself', tool: 'payment_release', args: {} },
]);
