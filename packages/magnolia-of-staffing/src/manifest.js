import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, CENSUS_FIELDS, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { checkStaffing } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const EMP_ID = { aliases: ['Employee ID', 'Employee #', 'Emp ID', 'Badge'], phi: 'mrn', translate: false };
const EMP_NAME = { aliases: ['Employee', 'Employee Name', 'Name', 'Staff'], phi: 'name' };
const AGENCY = { aliases: ['Agency', 'Agency Name', 'Staffing Agency', 'Vendor'] };
export const TIME_FIELDS = Object.freeze({ employee_id: EMP_ID, employee_name: EMP_NAME, role: { aliases: ['Role', 'Job Title', 'Position', 'Job Code', 'Discipline'], required: true }, date: { aliases: ['Date', 'Work Date', 'Shift Date'], type: 'date', required: true }, in: { aliases: ['In', 'Time In', 'Clock In', 'Start'] }, out: { aliases: ['Out', 'Time Out', 'Clock Out', 'End'] }, hours: { aliases: ['Hours', 'Hours Worked', 'Total Hours'], type: 'number' }, agency: { aliases: ['Agency Staff', 'Is Agency', 'Contract'] }, agency_name: AGENCY });
export const INVOICE_FIELDS = Object.freeze({ agency: { ...AGENCY, required: true }, employee_id: EMP_ID, employee_name: EMP_NAME, date: { aliases: ['Date', 'Shift Date', 'Work Date'], type: 'date', required: true }, hours: { aliases: ['Hours', 'Billed Hours', 'Hours Billed'], type: 'number', required: true } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  targets: { type: 'object', additionalProperties: false, description: 'Your hours-per-resident-day targets (your state minimum or your own goal)', properties: { total: { type: 'number', minimum: 0, description: 'RN + LPN + CNA hours per resident day' }, rn: { type: 'number', minimum: 0, description: 'RN hours per resident day' }, cna: { type: 'number', minimum: 0, description: 'Nurse aide hours per resident day' } } },
  pbj_submitted: { type: 'object', description: 'PBJ submission dates by quarter end: {"2026-03-31": "2026-05-02"}', additionalProperties: { type: 'string', format: 'date' } },
  pbj_warn_days: { type: 'integer', minimum: 0, maximum: 90, description: 'Warn this many days before the PBJ deadline (default 30)' },
} };
export const MEMORY_KINDS = Object.freeze({ staffing_note: { description: 'A staffing note, e.g. {"note": "DON hours are excluded from direct care in our state"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  time: fileArg('Nursing time records under --root: employee, role (RN, LPN, CNA...), date, in, out or hours, agency'),
  census: fileArg('Census under --root for the same dates'),
  invoices: fileArg('Optional agency invoices under --root: agency, employee, date, hours billed'),
  rules: fileArg('Optional rules JSON: targets, pbj_submitted, pbj_warn_days'),
  start: DATE_ARG('First day to check (YYYY-MM-DD)'),
  end: DATE_ARG('Last day to check (YYYY-MM-DD)'),
  as_of: DATE_ARG('Date for the PBJ deadline (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'magnolia_rules') : {}; return checkStaffing(ctx.records(a.time, 'time'), ctx.records(a.census, 'census'), a.invoices ? ctx.records(a.invoices, 'invoices') : [], { start: a.start, end: a.end, asOf: a.as_of || today(), targets: r.targets || {}, pbjSubmitted: r.pbj_submitted || {}, pbjWarnDays: r.pbj_warn_days }); };
const summary = (o) => `${o.resident_days} resident day(s) from ${o.start} to ${o.end}; ${o.avg_total_hprd} nursing hours per resident day (RN ${o.avg_rn_hprd}). PBJ for the quarter ending ${o.pbj_quarter_end} is due ${o.pbj_due}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'magnolia', title: 'Magnolia of Staffing',
  description: 'Nursing-home staffing and PBJ checks: hours per resident day by role against your targets, days without 8 consecutive RN hours, agency invoices against agency timecards and the Payroll-Based Journal due date. Employee names and ids are masked before results reach the model.',
  args, required: ['time', 'census', 'start', 'end'],
  sources: { time: { label: 'Nursing time records', args: ['time'], fields: TIME_FIELDS }, census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, invoices: { label: 'Agency invoices', args: ['invoices'], fields: INVOICE_FIELDS } },
  configSchemas: { magnolia_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check staffing', description: 'Work out nursing hours per resident day, RN coverage, agency hours and the PBJ deadline for a date range.' },
  report: {
    title: { en: 'Staffing and PBJ review', es: 'Revisión de dotación y PBJ', de: 'Personal- und PBJ-Prüfung', fr: 'Revue des effectifs et PBJ', pt: 'Revisão de pessoal e PBJ', it: 'Revisione del personale e PBJ', ja: '人員配置とPBJのレビュー', zh: '人员配置与PBJ审查', ko: '인력 배치 및 PBJ 검토' },
    base: 'magnolia-staffing',
    rows: (o) => o.items.map((i) => ({ status: i.status, date: i.date, agency: i.agency || '', employee_id: i.employee_id || '', employee_name: i.employee_name || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'date', 'agency', 'employee_name', 'amount', 'message'],
    sections: (o) => [{ title: { en: 'Hours per resident day' }, rows: o.daily, columns: ['date', 'residents', 'rn_hours', 'lpn_hours', 'cna_hours', 'total_hprd', 'rn_hprd', 'cna_hprd', 'rn_longest_hours'] }],
    limits: [EVERGREEN_LIMITS.files, 'Which hours count (DON, MDS coordinator, administrative nurses) and the minimums differ by state and by CMS rules that have changed since 2024; set your targets from current rules. The PBJ deadline is 45 days after each quarter.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'pbj_submit', category: 'binding_send', description: 'Magnolia never submits PBJ files to CMS.' }],
  prompt: { title: 'Staffing check', description: 'Walks the host model through a staffing check with Magnolia.', text: 'You are helping a nursing-home administrator or staffing coordinator with magnolia-of-staffing.\n\nRules: Magnolia reads files only. Employee names and ids are masked.\n\n1. Call magnolia_check for the dates.\n2. Lead with days missing 8 consecutive RN hours.\n3. Then hours per resident day below target, agency differences and the PBJ date.\n4. Call magnolia_write_report.' },
});
