import { runDemo } from 'evergreen-core';

const f = { leases: 'leases.csv', rent: 'rent-roll.csv', financials: 'operator-financials.csv', rules: 'rules.json', as_of: '2026-04-20' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Beech of PropCo', [
  { label: 'Review the leases', tool: 'beech_check', args: f, list: (i) => `${i.status.padEnd(21)} ${i.message}` },
  { label: 'Write the lease review', tool: 'beech_write_report', args: f },
  { label: 'Agent tries to send a default notice itself', tool: 'default_notice_send', args: {} },
]);
