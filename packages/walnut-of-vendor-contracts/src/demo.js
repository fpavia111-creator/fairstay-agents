import { runDemo } from 'evergreen-core';

const f = { contracts: 'contracts.csv', spend: 'spend.csv', prices: 'prices.csv', rules: 'rules.json', as_of: '2026-04-01' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Walnut of Vendor Contracts', [
  { label: 'Review vendor contracts', tool: 'walnut_check', args: f, list: (i) => `${i.status.padEnd(30)} ${i.message}` },
  { label: 'Write the review', tool: 'walnut_write_report', args: f },
  { label: 'Agent tries to send a notice itself', tool: 'contract_notice_send', args: {} },
]);
