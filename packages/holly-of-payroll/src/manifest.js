import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, EVERGREEN_LIMITS } from 'evergreen-core';
import { auditPayroll } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const EMP_ID = { aliases: ['Employee ID', 'Employee #', 'Emp ID', 'Badge', 'File Number', 'Employee Number'], phi: 'mrn', translate: false };
const EMP_NAME = { aliases: ['Employee', 'Employee Name', 'Name', 'Worker'], phi: 'name' };
const d = (aliases, extra = {}) => ({ aliases, type: 'date', ...extra }); const h = (aliases) => ({ aliases, type: 'number' }); const m = (aliases) => ({ aliases, type: 'money' });
export const PUNCH_FIELDS = Object.freeze({ employee_id: EMP_ID, employee_name: EMP_NAME, date: d(['Date', 'Work Date', 'Shift Date', 'Punch Date'], { required: true }), in: { aliases: ['In', 'Time In', 'Clock In', 'Punch In', 'Start'] }, out: { aliases: ['Out', 'Time Out', 'Clock Out', 'Punch Out', 'End'] } });
export const REGISTER_FIELDS = Object.freeze({ employee_id: EMP_ID, employee_name: EMP_NAME, pay_date: d(['Pay Date', 'Check Date']), period_start: d(['Period Start', 'Pay Period Start', 'Begin']), period_end: d(['Period End', 'Pay Period End', 'End']), regular_hours: h(['Regular Hours', 'Reg Hours', 'REG']), ot_hours: h(['OT Hours', 'Overtime Hours', 'OT']), rate: m(['Rate', 'Base Rate', 'Hourly Rate', 'Pay Rate']), diff_pay: m(['Differential', 'Shift Diff', 'Diff Pay', 'Shift Differential']), ot_pay: m(['OT Pay', 'Overtime Pay', 'OT Earnings']), gross: m(['Gross', 'Gross Pay', 'Total Earnings']), garnishment: m(['Garnishment', 'Garnish', 'Wage Garnishment']), garnishment_type: { aliases: ['Garnishment Type', 'Garnish Type', 'Order Type'] }, disposable: m(['Disposable', 'Disposable Earnings']) });
export const EMPLOYEE_FIELDS = Object.freeze({ employee_id: EMP_ID, employee_name: EMP_NAME, terminated_on: d(['Terminated', 'Termination Date', 'Term Date']), ot_rule: { aliases: ['OT Rule', 'Overtime Rule', 'OT Method'] } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  week_start: { type: 'integer', minimum: 0, maximum: 6, description: 'First day of the workweek, 0 = Sunday (default 0)' },
  hours_tolerance: { type: 'number', minimum: 0, maximum: 2, description: 'Allowed difference between paid and punched hours (default 0.25)' },
  garnish_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Limit for ordinary garnishments, percent of disposable earnings (default 25; your state may be lower)' },
  support_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Limit for support orders (default 50; can be up to 65 by federal law depending on the order)' },
  default_ot_rule: { type: 'string', enum: ['40', '8/80'], description: 'Overtime rule when the employee file does not say (default 40)' },
} };
export const MEMORY_KINDS = Object.freeze({ payroll_note: { description: 'A note on how payroll runs, e.g. {"note": "8/80 for nursing staff only; pay periods start Sunday"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  punches: fileArg('Time clock punches under --root: employee, date, in, out'),
  register: fileArg('Payroll register under --root: employee, pay date, period, regular and overtime hours, rate, shift differential pay, overtime pay, gross, garnishment, garnishment type, disposable earnings'),
  employees: fileArg('Optional employee file under --root: employee, termination date, overtime rule (40 or 8/80)'),
  rules: fileArg('Optional rules JSON: week_start, hours_tolerance, garnish_pct, support_pct, default_ot_rule'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'holly_rules') : {}; return auditPayroll(ctx.records(a.punches, 'punches'), ctx.records(a.register, 'register'), a.employees ? ctx.records(a.employees, 'employees') : [], { weekStart: r.week_start, hoursTolerance: r.hours_tolerance, garnishPct: r.garnish_pct, supportPct: r.support_pct, defaultRule: r.default_ot_rule }); };
const summary = (o) => `${o.employees_paid} employee(s) paid, gross ${o.gross}; ${o.at_risk} at risk. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Payroll matches the time clock'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'holly', title: 'Holly of Payroll',
  description: 'Payroll audit for nursing homes before the payroll is released: missing punches, paid hours that differ from the time clock, overtime under the 40-hour or 8/80 rule, shift differentials left out of the overtime rate, garnishments over the limit and terminated staff still paid. Employee names and ids are masked before results reach the model.',
  args, required: ['punches', 'register'],
  sources: { punches: { label: 'Time clock punches', args: ['punches'], fields: PUNCH_FIELDS }, register: { label: 'Payroll register', args: ['register'], fields: REGISTER_FIELDS }, employees: { label: 'Employee file', args: ['employees'], fields: EMPLOYEE_FIELDS } },
  configSchemas: { holly_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Audit payroll', description: 'Compare the payroll register with the time clock before payroll is released.' },
  report: {
    title: { en: 'Payroll audit', es: 'Auditoría de nómina', de: 'Lohnabrechnungsprüfung', fr: 'Audit de la paie', pt: 'Auditoria da folha de pagamento', it: 'Verifica delle buste paga', ja: '給与監査', zh: '工资审核', ko: '급여 감사' },
    base: 'holly-payroll-audit',
    rows: (o) => o.items.map((i) => ({ status: i.status, employee_id: i.employee_id || '', employee_name: i.employee_name || '', pay_date: i.pay_date || i.date || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'employee_name', 'pay_date', 'amount', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Overtime and garnishment rules are summarised from the federal FLSA and CCPA; states can be stricter (daily overtime, lower garnishment limits). Hospitals and nursing homes may use 8/80 only with an agreement with the employee.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'payroll_release', category: 'money_movement', description: 'Holly never releases, changes or voids a payroll.' }],
  prompt: { title: 'Payroll audit', description: 'Walks the host model through the payroll audit with Holly.', text: 'You are helping a nursing-home payroll lead with holly-of-payroll.\n\nRules: Holly reads files only. Employee names and ids are masked.\n\n1. Call holly_check before payroll is released.\n2. Lead with terminated_paid and overtime problems.\n3. Call holly_write_report.' },
});
