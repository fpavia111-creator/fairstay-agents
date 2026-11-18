import { runDemo } from 'fairstay-core';

const f = { bank: 'bank.csv', books: 'books.csv', rules: 'rules.json', as_of: '2026-03-31' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Bank Reconciliation', [
  { label: 'Reconcile the operating account', tool: 'bankrec_check', args: f, list: (i) => `${i.status.padEnd(24)} ${String(i.amount).padStart(9)}  ${i.message}` },
  { label: 'Write the reconciliation', tool: 'bankrec_write_report', args: f },
  { label: 'Agent tries to move money itself', tool: 'bank_transfer', args: {} },
]);
