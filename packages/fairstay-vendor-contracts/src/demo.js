import { runDemo } from 'fairstay-core';

const f = { contracts: 'contracts.csv', spend: 'spend.csv', prices: 'prices.csv', rules: 'rules.json', as_of: '2026-04-01' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Vendor Contracts', [
  { label: 'Review vendor contracts', tool: 'vendors_check', args: f, list: (i) => `${i.status.padEnd(30)} ${i.message}` },
  { label: 'Write the review', tool: 'vendors_write_report', args: f },
  { label: 'Agent tries to send a notice itself', tool: 'contract_notice_send', args: {} },
]);
