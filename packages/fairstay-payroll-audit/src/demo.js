import { runDemo } from 'fairstay-core';

const f = { punches: 'punches.csv', register: 'register.csv', employees: 'employees.csv', rules: 'rules.json' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Payroll Audit', [
  { label: 'Audit payroll before release', tool: 'payroll_check', args: f, list: (i) => `${i.status.padEnd(24)} ${String(i.amount).padStart(8)}  ${i.message}` },
  { label: 'Write the audit', tool: 'payroll_write_report', args: f },
  { label: 'Agent tries to release payroll itself', tool: 'payroll_release', args: {} },
]);
