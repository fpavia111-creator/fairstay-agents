import { runDemo } from 'fairstay-core';

const f = { applications: 'applications.csv', census: 'census.csv', rules: 'rules.json', as_of: '2026-03-03' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Medicaid Pending', [
  { label: 'Run the weekly Medicaid pending review', tool: 'pending_check', args: f, list: (i) => `${i.status.padEnd(22)} ${String(i.amount).padStart(9)}  ${i.message}` },
  { label: 'Write the meeting list (Spanish page)', tool: 'pending_write_report', args: { ...f, language: 'es' } },
  { label: 'Agent tries to file an application itself', tool: 'medicaid_application_submit', args: {} },
]);
