import { runDemo } from 'fairstay-core';

const f = { contracts: 'contracts.csv', payments: 'payments.csv', rules: 'rules.json', as_of: '2026-04-01' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay MCO Contracts', [
  { label: 'Review managed care contracts', tool: 'mco_check', args: f, list: (i) => `${i.status.padEnd(20)} ${i.message}` },
  { label: 'Payer matrix for admissions', tool: 'mco_payer_matrix', args: { contracts: f.contracts, rules: f.rules, as_of: f.as_of } },
  { label: 'Write the review', tool: 'mco_write_report', args: f },
  { label: 'Agent tries to send a termination notice itself', tool: 'contract_notice_send', args: {} },
]);
