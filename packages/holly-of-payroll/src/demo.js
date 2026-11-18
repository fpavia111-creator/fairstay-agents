import { runDemo } from 'evergreen-core';

const f = { punches: 'punches.csv', register: 'register.csv', employees: 'employees.csv', rules: 'rules.json' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Holly of Payroll', [
  { label: 'Audit payroll before release', tool: 'holly_check', args: f, list: (i) => `${i.status.padEnd(24)} ${String(i.amount).padStart(8)}  ${i.message}` },
  { label: 'Write the audit', tool: 'holly_write_report', args: f },
  { label: 'Agent tries to release payroll itself', tool: 'payroll_release', args: {} },
]);
