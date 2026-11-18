import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, MONTH_ARG, AMOUNT, EVERGREEN_LIMITS } from 'fairstay-core';
import { accruals } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const EMP_ID = { aliases: ['Employee ID', 'Employee #', 'Emp ID', 'File Number'], phi: 'mrn', translate: false };
const EMP_NAME = { aliases: ['Employee', 'Employee Name', 'Name'], phi: 'name' };
const DEPT = { aliases: ['Department', 'Dept', 'Cost Center', 'Home Department'] };
export const REGISTER_FIELDS = Object.freeze({ employee_id: EMP_ID, employee_name: EMP_NAME, department: DEPT, period_start: { aliases: ['Period Start', 'Pay Period Start', 'Begin'], type: 'date', required: true }, period_end: { aliases: ['Period End', 'Pay Period End', 'End'], type: 'date', required: true }, pay_date: { aliases: ['Pay Date', 'Check Date'], type: 'date' }, gross: { aliases: ['Gross', 'Gross Pay', 'Total Earnings'], type: 'money', required: true } });
export const PTO_FIELDS = Object.freeze({ employee_id: EMP_ID, employee_name: EMP_NAME, department: DEPT, hours: { aliases: ['Hours', 'PTO Hours', 'Balance Hours', 'Available Hours'], type: 'number', required: true }, rate: { aliases: ['Rate', 'Hourly Rate', 'Pay Rate'], type: 'money', required: true } });
export const BOOKED_FIELDS = Object.freeze({ department: DEPT, kind: { aliases: ['Kind', 'Type', 'Accrual', 'Account Name'] }, amount: { ...AMOUNT, required: true } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: { employer_tax_pct: { type: 'number', minimum: 0, maximum: 30, description: 'Employer payroll taxes as a percent of wages (FICA 7.65 plus unemployment; default 8.5)' }, tolerance: { type: 'number', minimum: 0, description: 'Differences up to this amount are left alone (default 500)' }, pto_taxed: { type: 'boolean', description: 'Add employer taxes to the PTO liability (default true)' } } };
export const MEMORY_KINDS = Object.freeze({ accrual_note: { description: 'A note on accrual practice, e.g. {"note": "agency staff are accrued from invoices in sycamore, not here"}.', effect: 'is shown with results. It never changes the numbers.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  register: fileArg('Payroll register for the pay periods around month end under --root: employee, department, period start and end, pay date, gross'),
  pto: fileArg('PTO balances at month end under --root: employee, department, hours, hourly rate'),
  booked: fileArg('Accruals already booked under --root: department, kind (wages or PTO), amount'),
  rules: fileArg('Optional rules JSON: employer_tax_pct, tolerance, pto_taxed'),
  month: MONTH_ARG,
};
const run = (a, ctx) => { if (!/^\d{4}-\d{2}$/.test(a.month || '')) throw new Error('month must be YYYY-MM'); const r = a.rules ? ctx.readJson(a.rules, 'accruals_rules') : {}; return accruals(ctx.records(a.register, 'register'), a.pto ? ctx.records(a.pto, 'pto') : [], a.booked ? ctx.records(a.booked, 'booked') : [], { month: a.month, employerTaxPct: r.employer_tax_pct, tolerance: r.tolerance, ptoTaxed: r.pto_taxed ?? true }); };
const summary = (o) => `At ${o.month_end}: wage accrual ${o.wage_accrual} (booked ${o.booked_wages}); PTO liability ${o.pto_liability} (booked ${o.booked_pto}). ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Booked accruals match'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'accruals', title: 'Fairstay Payroll Accruals',
  description: 'Payroll and PTO accruals at month end for nursing homes: wages earned but not paid by department, employer taxes, PTO liability, the difference from what is booked, and journal entry lines a person posts. Employee names and ids are masked before results reach the model.',
  args, required: ['register', 'month'],
  sources: { register: { label: 'Payroll register', args: ['register'], fields: REGISTER_FIELDS }, pto: { label: 'PTO balances', args: ['pto'], fields: PTO_FIELDS }, booked: { label: 'Booked accruals', args: ['booked'], fields: BOOKED_FIELDS } },
  configSchemas: { accruals_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Work out payroll accruals', description: 'Calculate wage and PTO accruals by department and compare them with what is booked.' },
  report: {
    title: { en: 'Payroll accruals and journal lines', es: 'Devengos de nómina y asientos', de: 'Lohnabgrenzungen und Buchungszeilen', fr: 'Provisions de paie et écritures', pt: 'Provisões de folha e lançamentos', it: 'Ratei del personale e scritture', ja: '給与未払計上と仕訳', zh: '工资应计与分录', ko: '급여 미지급 계상 및 분개' },
    base: 'accruals',
    rows: (o) => o.items.map((i) => ({ status: i.status, department: i.department, calculated: i.calculated, booked: i.booked, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'department', 'calculated', 'booked', 'amount', 'message'],
    sections: (o) => [{ title: { en: 'By department' }, rows: o.departments, columns: ['department', 'wages', 'taxes', 'wage_accrual', 'booked_wages', 'wage_adjustment', 'pto_liability', 'booked_pto', 'pto_adjustment'] }, { title: { en: 'Journal entry lines (not posted)' }, rows: o.journal, columns: ['department', 'account', 'debit', 'credit'] }],
    limits: [EVERGREEN_LIMITS.files, 'Wages are split by calendar days in the pay period; use your own policy if it differs. Whether PTO is a liability depends on your PTO policy and state law.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'journal_post', category: 'binding_send', description: 'Fairstay Payroll Accruals never posts journal entries.' }],
  prompt: { title: 'Payroll accruals', description: 'Walks the host model through payroll accruals with Fairstay Payroll Accruals.', text: 'You are helping a nursing-home staff accountant with fairstay-payroll-accruals.\n\nRules: Fairstay Payroll Accruals works out numbers; a person posts entries.\n\n1. Call accruals_check for the month.\n2. Give the adjustments by department and the journal lines.\n3. Call accruals_write_report.' },
});
