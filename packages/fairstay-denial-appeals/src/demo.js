import { runDemo } from 'fairstay-core';

const f = { denials: 'denials.csv', rules: 'rules.json', as_of: '2026-04-15' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Denial Appeals', [
  { label: 'List open denials with their next appeal deadline', tool: 'appeals_check', args: f, list: (i) => `${i.status.padEnd(21)} ${String(i.amount).padStart(8)}  ${i.message}` },
  { label: 'Draft the appeal letter that is due soonest', tool: 'appeals_draft_appeal_letter', args: { ...f, claim_id: 'D-3002' }, approve: 'Demo reviewer' },
  { label: 'Write the deadline list', tool: 'appeals_write_report', args: f },
  { label: 'Agent tries to submit an appeal itself', tool: 'appeal_submit', args: {} },
]);
