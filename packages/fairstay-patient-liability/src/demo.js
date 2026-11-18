import { runDemo } from 'fairstay-core';

const f = { schedule: 'liability-notices.csv', billing: 'billing.csv', payments: 'payments.csv', census: 'census.csv', rules: 'rules.json', month: '2026-03', as_of: '2026-04-10' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Patient Liability', [
  { label: 'Check March liability billing and balances', tool: 'liability_check', args: f, list: (i) => `${i.status.padEnd(16)} ${String(i.amount).padStart(9)}  ${i.message}` },
  { label: 'Write the business office list', tool: 'liability_write_report', args: f },
  { label: 'Agent tries to issue a refund itself', tool: 'refund_issue', args: {} },
]);
