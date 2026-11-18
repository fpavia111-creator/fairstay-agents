import { runDemo } from 'evergreen-core';

const f = { bank: 'bank.csv', books: 'books.csv', rules: 'rules.json', as_of: '2026-03-31' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Cypress of Cash', [
  { label: 'Reconcile the operating account', tool: 'cypress_check', args: f, list: (i) => `${i.status.padEnd(24)} ${String(i.amount).padStart(9)}  ${i.message}` },
  { label: 'Write the reconciliation', tool: 'cypress_write_report', args: f },
  { label: 'Agent tries to move money itself', tool: 'bank_transfer', args: {} },
]);
