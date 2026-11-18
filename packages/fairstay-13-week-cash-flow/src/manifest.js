import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, PAYER, PAYER_TYPE, AMOUNT, PAYER_TYPES, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { projectCash } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const CASH_FIELDS = Object.freeze({ account: { aliases: ['Account', 'Account Number', 'Bank Account', 'Acct'], phi: 'account' }, balance: { aliases: ['Balance', 'Ending Balance', 'Available', 'Ledger Balance', 'Amount'], type: 'money', required: true } });
export const AR_FIELDS = Object.freeze({ payer: PAYER, payer_type: PAYER_TYPE, amount: { ...AMOUNT, aliases: ['Amount', 'Balance', 'Open Balance', 'Total'], required: true } });
export const BILL_FIELDS = Object.freeze({ vendor: { aliases: ['Vendor', 'Payee', 'Vendor Name'] }, due_date: { aliases: ['Due Date', 'Due', 'Pay Date'], type: 'date', required: true }, amount: { ...AMOUNT, required: true } });
const byType = (item) => ({ type: 'object', propertyNames: { enum: PAYER_TYPES }, additionalProperties: item, description: 'By payer type' });
const PLAN_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  collect: { ...byType({ type: 'object', additionalProperties: false, properties: { pct: { type: 'number', minimum: 0, maximum: 1, description: 'Share collected' }, weeks: { type: 'integer', minimum: 1, maximum: 13, description: 'Spread over this many weeks' } } }), description: 'How today\'s receivables come in, by payer type' },
  weekly_billing: { ...byType({ type: 'number', minimum: 0 }), description: 'New revenue billed each week, by payer type' },
  lag: { ...byType({ type: 'object', additionalProperties: false, properties: { pct: { type: 'number', minimum: 0, maximum: 1, description: 'Share collected' }, lag_weeks: { type: 'integer', minimum: 0, maximum: 12, description: 'Weeks from billing to cash' } } }), description: 'When new billing turns into cash, by payer type' },
  payroll: { type: 'object', additionalProperties: false, required: ['amount', 'first_date'], properties: { amount: { type: 'number', minimum: 0, description: 'Net pay plus taxes per payroll' }, first_date: { type: 'string', format: 'date', description: 'Next pay date' }, every_days: { type: 'integer', minimum: 7, maximum: 31, description: 'Days between payrolls (default 14)' } }, description: 'Payroll' },
  fixed: { type: 'array', description: 'Fixed monthly payments', items: { type: 'object', additionalProperties: false, required: ['name', 'amount', 'day_of_month'], properties: { name: { type: 'string', description: 'What it is' }, amount: { type: 'number', minimum: 0, description: 'Amount' }, day_of_month: { type: 'integer', minimum: 1, maximum: 31, description: 'Day paid' } } } },
  min_cash: { type: 'number', minimum: 0, description: 'Lowest cash you are comfortable with' },
} };
export const MEMORY_KINDS = Object.freeze({ cash_note: { description: 'A cash timing note, e.g. {"note": "Medicaid pays on Thursdays; provider tax due the 15th"}.', effect: 'is shown with results. It never changes the projection.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  opening: fileArg('Cash balances today under --root: account, balance'),
  ar: fileArg('Open receivables under --root: payer or payer type, amount (an aging summary is enough)'),
  bills: fileArg('Bills to pay under --root: vendor, due date, amount'),
  plan: fileArg('Plan JSON: collection rates, weekly billing and lag by payer type, payroll, fixed payments, minimum cash'),
  start: DATE_ARG('First day of week 1 (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => projectCash(ctx.records(a.opening, 'opening'), ctx.records(a.ar, 'ar'), a.bills ? ctx.records(a.bills, 'bills') : [], ctx.readJson(a.plan, 'cashflow_plan'), { start: a.start || today() });
const summary = (o) => `13 weeks from ${o.start}: opening ${o.opening_cash}, ending ${o.ending_cash}; lowest ${o.lowest_cash} in week ${o.lowest_week} against a ${o.min_cash} minimum. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Every week stays above the minimum'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'cashflow', title: 'Fairstay 13 Week Cash Flow',
  description: '13-week cash projection for a nursing home from opening cash, receivables and collection rates by payer type, new billing with its lag, payroll dates, bills due and fixed monthly payments, flagging weeks below your minimum cash or overdrawn. Arithmetic on your numbers, not a forecast. Bank account numbers are masked before results reach the model.',
  args, required: ['opening', 'ar', 'plan'],
  sources: { opening: { label: 'Cash balances', args: ['opening'], fields: CASH_FIELDS }, ar: { label: 'Receivables', args: ['ar'], fields: AR_FIELDS }, bills: { label: 'Bills due', args: ['bills'], fields: BILL_FIELDS } },
  configSchemas: { cashflow_plan: PLAN_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Project 13 weeks of cash', description: 'Build the week-by-week projection and list weeks below the minimum.' },
  report: {
    title: { en: '13-week cash projection', es: 'Proyección de caja a 13 semanas', de: '13-Wochen-Liquiditätsplanung', fr: 'Prévision de trésorerie sur 13 semaines', pt: 'Projeção de caixa de 13 semanas', it: 'Proiezione di cassa a 13 settimane', ja: '13週間資金繰り予測', zh: '13周现金预测', ko: '13주 현금 예측' },
    base: 'cashflow-cash-13-week',
    rows: (o) => o.projection.map((w) => ({ status: (o.items.find((i) => i.week === w.week && ['negative_cash', 'below_minimum'].includes(i.status)) || {}).status || 'ok', week: w.week, start: w.start, opening: w.opening, ar_collections: w.ar_collections, new_collections: w.new_collections, payroll: w.payroll, bills: w.bills, fixed: w.fixed, net: w.net, ending: w.ending })),
    htmlColumns: ['status', 'week', 'start', 'opening', 'ar_collections', 'new_collections', 'payroll', 'bills', 'fixed', 'ending'],
    sections: (o) => [{ title: { en: 'Findings' }, rows: o.items.map((i) => ({ status: i.status, week: i.week ?? '', amount: i.amount, message: i.message })), columns: ['status', 'week', 'amount', 'message'] }],
    limits: [EVERGREEN_LIMITS.files, EVERGREEN_LIMITS.estimate, EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'line_draw', category: 'money_movement', description: 'Fairstay 13 Week Cash Flow never draws on a credit line or moves money.' }],
  prompt: { title: 'Weekly cash meeting', description: 'Walks the host model through the 13-week cash projection with Fairstay 13 Week Cash Flow.', text: 'You are helping a nursing-home controller with fairstay-13-week-cash-flow.\n\nRules: Fairstay 13 Week Cash Flow is arithmetic on the numbers given, not a forecast.\n\n1. Call cashflow_check.\n2. Lead with the lowest week and any week below the minimum.\n3. Call cashflow_write_report for the lender or owner.' },
});
