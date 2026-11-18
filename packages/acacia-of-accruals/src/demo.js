import { runDemo } from 'evergreen-core';

const f = { register: 'register.csv', pto: 'pto-2026-03-31.csv', booked: 'booked.csv', rules: 'rules.json', month: '2026-03' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Acacia of Accruals', [
  { label: 'Work out March payroll accruals', tool: 'acacia_check', args: f, list: (i) => `${i.status.padEnd(18)} ${String(i.amount).padStart(9)}  ${i.message}` },
  { label: 'Write the accruals and journal lines', tool: 'acacia_write_report', args: f },
  { label: 'Agent tries to post the entry itself', tool: 'journal_post', args: {} },
]);
