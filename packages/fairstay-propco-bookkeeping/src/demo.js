import { runDemo } from 'fairstay-core';

const f = { leases: 'leases.csv', rent: 'rent-roll.csv', financials: 'operator-financials.csv', rules: 'rules.json', as_of: '2026-04-20' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay PropCo Bookkeeping', [
  { label: 'Review the leases', tool: 'propco_check', args: f, list: (i) => `${i.status.padEnd(21)} ${i.message}` },
  { label: 'Write the lease review', tool: 'propco_write_report', args: f },
  { label: 'Agent tries to send a default notice itself', tool: 'default_notice_send', args: {} },
]);
