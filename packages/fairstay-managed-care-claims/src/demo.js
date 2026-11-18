import { runDemo } from 'fairstay-core';

const f = { claims: 'claims.csv', rates: 'contract-rates.csv', auths: 'auths.csv' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Managed Care Claims', [
  { label: 'Check March managed care claims', tool: 'mcclaims_check', args: f, list: (i) => `${i.status.padEnd(22)} ${i.claim_id} ${String(i.amount).padStart(8)}  ${i.message}` },
  { label: 'Write the managed care biller\'s list', tool: 'mcclaims_write_report', args: f },
  { label: 'Teach a plan\'s own level code', tool: 'mcclaims_learn', args: { kind: 'level_alias', value: { payer: 'Bayou Senior Care Plan (fictional)', code: 'RB9', level: 'RB2' } } },
  { label: 'Agent tries to submit a claim itself', tool: 'claim_submit', args: {} },
]);
