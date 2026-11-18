import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { testCovenants, TESTS } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const m = (aliases, extra = {}) => ({ aliases, type: 'money', ...extra });
export const FIN_FIELDS = Object.freeze({ period: { aliases: ['Period', 'Month', 'Fiscal Month', 'Period End'], required: true }, beds: { aliases: ['Beds', 'Licensed Beds', 'Operating Beds'], type: 'number' }, patient_days: { aliases: ['Patient Days', 'Resident Days', 'Census Days'], type: 'number' }, days: { aliases: ['Days', 'Days in Period'], type: 'number' }, ebitdar: m(['EBITDAR', 'EBITDARM', 'Operating Income Before Rent']), rent: m(['Rent', 'Lease Expense', 'Rent Expense']), interest: m(['Interest', 'Interest Expense']), principal: m(['Principal', 'Principal Payments']), operating_expenses: m(['Operating Expenses', 'Total Expenses', 'Cash Operating Expenses', 'Opex']), cash: m(['Cash', 'Unrestricted Cash', 'Cash Balance']) });
export const COVENANT_FIELDS = Object.freeze({ name: { aliases: ['Covenant', 'Name', 'Test'], required: true }, loan: { aliases: ['Loan', 'Loan Number', 'Loan #', 'Lease', 'Agreement'], phi: 'account' }, test: { aliases: ['Measure', 'Type', 'Metric', 'Ratio'], enum: TESTS, required: true }, min: { aliases: ['Minimum', 'Min', 'Required', 'Threshold'], type: 'number', required: true }, period: { aliases: ['Test Period', 'Basis', 'Measurement Period'] }, reporting_days: { aliases: ['Reporting Days', 'Due Days', 'Days After Period'], type: 'number' }, delivered_on: { aliases: ['Delivered', 'Delivered On', 'Sent On'], type: 'date' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: { warn_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Flag cushions under this percent (default 10)' }, due_warn_days: { type: 'integer', minimum: 0, maximum: 60, description: 'Flag reporting due within this many days (default 14)' } } };
export const MEMORY_KINDS = Object.freeze({ covenant_definition: { description: 'How the loan defines a ratio, e.g. {"name": "Rent coverage", "note": "EBITDAR after a 5% management fee"}.', effect: 'is shown with results. It never changes a test.', schema: { type: 'object', additionalProperties: false, required: ['name', 'note'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  financials: fileArg('Monthly financials under --root: period, beds, patient days, EBITDAR, rent, interest, principal, operating expenses, cash'),
  covenants: fileArg('Covenant list under --root: name, loan or lease, test (occupancy, rent_coverage, dscr, fccr, days_cash), minimum, test period (month, quarter, ttm), reporting days, delivered date'),
  rules: fileArg('Optional rules JSON: warn_pct, due_warn_days'),
  period: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Month to test, YYYY-MM (default the latest month in the financials)' },
  as_of: DATE_ARG('Date for reporting deadlines (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'linden_rules') : {}; return testCovenants(ctx.records(a.financials, 'financials'), ctx.records(a.covenants, 'covenants'), { asOf: a.as_of || today(), period: a.period, warnPct: r.warn_pct, dueWarnDays: r.due_warn_days }); };
const summary = (o) => `${o.covenants} covenant(s) tested for ${o.period}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ')}.`;

export const manifest = snfAgent({
  pkg, prefix: 'linden', title: 'Linden of Covenants',
  description: 'Loan and lease covenant tests for nursing homes: occupancy, rent coverage, debt service coverage, fixed charge coverage and days cash on hand from monthly financials, with cushions, breaches, near misses and compliance reporting due dates. Arithmetic on your statements; your agreement defines each ratio. Loan numbers are masked before results reach the model.',
  args, required: ['financials', 'covenants'],
  sources: { financials: { label: 'Monthly financials', args: ['financials'], fields: FIN_FIELDS }, covenants: { label: 'Covenants', args: ['covenants'], fields: COVENANT_FIELDS } },
  configSchemas: { linden_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Test covenants', description: 'Work out each covenant for the month, with its cushion and reporting date.' },
  report: {
    title: { en: 'Covenant compliance', es: 'Cumplimiento de covenants', de: 'Covenant-Prüfung', fr: 'Respect des covenants', pt: 'Cumprimento de covenants', it: 'Rispetto dei covenant', ja: 'コベナンツ遵守状況', zh: '契约合规情况', ko: '약정 준수 현황' },
    base: 'linden-covenants',
    rows: (o) => o.items.map((i) => ({ status: i.status, name: i.name, loan: i.loan || '', test: i.test, period: i.period, value: i.value ?? '', minimum: i.minimum ?? '', cushion_pct: i.cushion_pct ?? '', due_date: i.due_date || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'name', 'value', 'minimum', 'cushion_pct', 'due_date', 'message'],
    limits: [EVERGREEN_LIMITS.files, 'Ratios use common definitions (rent coverage = EBITDAR / rent; DSCR = (EBITDAR - rent) / debt service; FCCR = EBITDAR / (rent + debt service)); your loan or lease defines them, and its definition wins.', EVERGREEN_LIMITS.estimate, EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'compliance_certificate_send', category: 'binding_send', description: 'Linden never signs or sends compliance certificates.' }],
  prompt: { title: 'Covenant check', description: 'Walks the host model through covenant testing with Linden.', text: 'You are helping a nursing-home CFO with linden-of-covenants.\n\nRules: Linden is arithmetic; the loan agreement defines each ratio.\n\n1. Call linden_check.\n2. Lead with breach and reporting_late, then near_miss.\n3. Call linden_write_report.' },
});
