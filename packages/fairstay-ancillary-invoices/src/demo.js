import { runDemo } from 'fairstay-core';

const f = { invoices: 'pharmacy-lab-2026-03.csv', census: 'census.csv', rates: 'contract-rates.csv', rules: 'rules.json' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Ancillary Invoices', [
  { label: 'Review March ancillary invoices', tool: 'ancillaries_check', args: f, list: (i) => `${i.status.padEnd(28)} ${String(i.amount).padStart(8)}  ${i.vendor}: ${i.message}` },
  { label: 'Draft the pharmacy credit request', tool: 'ancillaries_draft_credit_request', args: { ...f, invoice_no: 'GCP-0326' }, approve: 'Demo reviewer' },
  { label: 'Write the review', tool: 'ancillaries_write_report', args: f },
  { label: 'Agent tries to hold a vendor payment itself', tool: 'vendor_payment_hold', args: {} },
]);
