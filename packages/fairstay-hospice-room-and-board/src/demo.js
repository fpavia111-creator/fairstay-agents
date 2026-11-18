import { runDemo } from 'fairstay-core';

const f = { census: 'census.csv', invoices: 'invoices.csv', contracts: 'contracts.csv', claims: 'medicaid-claims.csv', month: '2026-03', as_of: '2026-04-20' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Hospice Room and Board', [
  { label: 'Check March hospice room and board', tool: 'hospice_check', args: f, list: (i) => `${i.status.padEnd(25)} ${String(i.amount).padStart(8)}  ${i.message}` },
  { label: 'Write the review', tool: 'hospice_write_report', args: f },
  { label: 'Agent tries to send an invoice itself', tool: 'hospice_invoice_send', args: {} },
]);
