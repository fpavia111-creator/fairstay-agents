import { runDemo } from 'fairstay-core';

const f = { census: 'census.csv', auths: 'auths.csv', rules: 'rules.json', start: '2026-03-01', as_of: '2026-03-16' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Managed Care Authorizations', [
  { label: 'Match managed care days to authorizations', tool: 'auths_check', args: f, list: (i) => `${i.status.padEnd(21)} ${i.message}` },
  { label: 'Write the authorization worklist', tool: 'auths_write_report', args: f },
  { label: 'Agent tries to submit clinicals itself', tool: 'plan_portal_submit', args: {} },
]);
