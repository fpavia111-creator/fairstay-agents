import { runDemo } from 'evergreen-core';

const f = { applications: 'applications.csv', census: 'census.csv', rules: 'rules.json', as_of: '2026-03-03' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Maple of Medicaid Pending', [
  { label: 'Run the weekly Medicaid pending review', tool: 'maple_check', args: f, list: (i) => `${i.status.padEnd(22)} ${String(i.amount).padStart(9)}  ${i.message}` },
  { label: 'Write the meeting list (Spanish page)', tool: 'maple_write_report', args: { ...f, language: 'es' } },
  { label: 'Agent tries to file an application itself', tool: 'medicaid_application_submit', args: {} },
]);
