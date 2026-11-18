import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, EVERGREEN_LIMITS, RESIDENT_NAME, RESIDENT_ID, PAYER, PAYER_TYPE, AMOUNT } from 'fairstay-core';
import { underwrite } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const MONTH = { aliases: ['Month', 'Period', 'Fiscal Month'], required: true };
export const T12_FIELDS = Object.freeze({ month: MONTH, account: { aliases: ['Account', 'Account Name', 'Line', 'Description', 'GL Account'], required: true }, group: { aliases: ['Group', 'Category', 'Type', 'Section'] }, amount: { ...AMOUNT, required: true }, one_time: { aliases: ['One Time', 'One-Time', 'Non Recurring', 'Adjust'] } });
export const CENSUS_MONTH_FIELDS = Object.freeze({ month: MONTH, payer: { ...PAYER, required: true }, payer_type: PAYER_TYPE, days: { aliases: ['Days', 'Patient Days', 'Resident Days', 'Census Days'], type: 'number', required: true } });
export const AR_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: { ...PAYER, required: true }, payer_type: PAYER_TYPE, age_days: { aliases: ['Age', 'Age Days', 'Days Outstanding', 'Days Old', 'Aging Days'], type: 'number' }, balance: { ...AMOUNT, aliases: ['Balance', 'Amount', 'Open Balance', 'Outstanding'], required: true } });
const RATES = { type: 'array', minItems: 4, maxItems: 4, items: { type: 'number', minimum: 0, maximum: 1 }, description: 'Share collected for 0-30, 31-90, 91-180 and 180+ days' };
const RULES_SCHEMA = { type: 'object', additionalProperties: false, required: ['beds', 'cap_rate'], properties: {
  beds: { type: 'integer', minimum: 1, description: 'Licensed beds' },
  cap_rate: { type: 'number', exclusiveMinimum: 0, maximum: 1, description: 'Your cap rate on year-one EBITDAR, e.g. 0.125' },
  mgmt_fee_pct: { type: 'number', minimum: 0, maximum: 20, description: 'Management fee to underwrite, percent of revenue (default 5)' },
  revenue_growth_pct: { type: 'number', minimum: -50, maximum: 50, description: 'Year-one revenue growth, percent (default 3)' },
  expense_growth_pct: { type: 'number', minimum: -50, maximum: 50, description: 'Year-one expense growth, percent (default 4)' },
  occupancy_target: { type: 'number', minimum: 0, maximum: 1, description: 'Occupancy below this is flagged (default 0.85)' },
  min_rent_coverage: { type: 'number', minimum: 0, description: 'Rent coverage floor (default 1.3)' },
  staffing: { type: 'object', additionalProperties: false, required: ['hprd', 'hourly_cost'], description: 'Staffing model: nursing hours per resident day and loaded cost per hour', properties: { hprd: { type: 'number', minimum: 0, maximum: 12, description: 'Nursing hours per resident day you will staff' }, hourly_cost: { type: 'number', minimum: 0, description: 'Loaded nursing cost per hour (wages, taxes, benefits)' } } },
  collect: { type: 'object', additionalProperties: false, description: 'Collection rates by payer type, overriding the defaults', properties: Object.fromEntries(['medicare_a', 'medicare_b', 'medicaid', 'medicaid_pending', 'managed_care', 'hospice', 'private', 'insurance', 'va', 'unknown'].map((k) => [k, RATES])) },
  one_time_accounts: { type: 'array', items: { type: 'string' }, description: 'Account names to treat as one-time' },
} };
export const MEMORY_KINDS = Object.freeze({ deal_note: { description: 'A note on this deal, e.g. {"note": "seller says the 2025 agency spike was a one-off flu outbreak"}.', effect: 'is shown with results. It never changes the numbers.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  t12: fileArg('Trailing twelve months under --root: month (YYYY-MM), account, group (revenue, nursing_labor, other_labor, non_labor, management_fee, rent, other), amount, one-time flag'),
  census: fileArg('Patient days by month and payer: month, payer, payer type, days'),
  ar: fileArg('Optional receivables aging: resident, payer, payer type, age in days, balance'),
  assumptions: fileArg('Assumptions JSON: beds, cap_rate, mgmt_fee_pct, growth, occupancy_target, min_rent_coverage, staffing, collect, one_time_accounts'),
};
const run = (a, ctx) => underwrite(ctx.records(a.t12, 't12'), ctx.records(a.census, 'census'), a.ar ? ctx.records(a.ar, 'ar') : [], ctx.readJson(a.assumptions, 'underwriting_assumptions'));
const summary = (o) => `T12 ${o.period.from} to ${o.period.to}: revenue ${o.t12.revenue}, EBITDAR ${o.t12.ebitdar}, normalized ${o.t12.normalized_ebitdar}; occupancy ${o.census.occupancy ?? 'n/a'}; year-one EBITDAR ${o.year_one.ebitdar}; value ${o.valuation.value ?? 'n/a'} (${o.valuation.value_per_bed ?? 'n/a'} a bed); receivables ${o.valuation.ar_gross} worth ${o.valuation.ar_value}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ')}.`;

export const manifest = snfAgent({
  pkg, prefix: 'underwriting', title: 'Fairstay Acquisition Underwriting',
  description: 'Acquisition underwriting packet for a nursing home: trailing-twelve-month summary with one-time items and the management fee normalized, occupancy and payer mix, a staffing model, a year-one projection, value at your cap rate, and the receivables valued by payer and age. Arithmetic on your numbers, not an appraisal. Resident names in the aging are masked before results reach the model.',
  args, required: ['t12', 'census', 'assumptions'],
  sources: { t12: { label: 'Trailing twelve months', args: ['t12'], fields: T12_FIELDS }, census: { label: 'Patient days by month', args: ['census'], fields: CENSUS_MONTH_FIELDS }, ar: { label: 'Receivables aging', args: ['ar'], fields: AR_FIELDS } },
  configSchemas: { underwriting_assumptions: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Underwrite the facility', description: 'Build the underwriting packet: T12, normalization, occupancy, payer mix, staffing, year one, value and receivables, with the items to diligence.' },
  report: {
    title: { en: 'Underwriting packet', es: 'Paquete de suscripción', de: 'Underwriting-Paket', fr: 'Dossier de souscription', pt: 'Pacote de subscrição', it: 'Pacchetto di underwriting', ja: '引受審査パケット', zh: '承销资料包', ko: '인수 심사 패킷' },
    base: 'underwriting',
    rows: (o) => o.items.map((i) => ({ status: i.status, account: i.account || i.month || i.payer_type || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'account', 'amount', 'message'],
    sections: (o) => [
      { title: 'T12 summary', rows: Object.entries(o.t12).map(([k, v]) => ({ line: k, value: v ?? '' })), columns: ['line', 'value'] },
      { title: 'Census and payer mix', rows: [{ payer_type: 'all', days: o.census.patient_days, share: 1 }, ...o.payer_mix], columns: ['payer_type', 'days', 'share'] },
      ...(o.staffing ? [{ title: 'Staffing model', rows: Object.entries(o.staffing).map(([k, v]) => ({ line: k, value: v })), columns: ['line', 'value'] }] : []),
      { title: 'Year one and value', rows: [...Object.entries(o.year_one), ...Object.entries(o.valuation)].map(([k, v]) => ({ line: k, value: v ?? '' })), columns: ['line', 'value'] },
      { title: 'Receivables', rows: o.ar, columns: ['payer_type', 'bucket', 'balance', 'rate', 'value'] },
    ],
    limits: [EVERGREEN_LIMITS.files, EVERGREEN_LIMITS.estimate, 'One-time items are found by flag and by words like settlement or provider relief; a deal team confirms each one against the ledger.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'loi_send', category: 'binding_send', description: 'Fairstay Acquisition Underwriting never sends a letter of intent, an offer or a term sheet.' }],
  prompt: { title: 'Underwriting review', description: 'Walks the host model through a first-pass underwriting with Fairstay Acquisition Underwriting.', text: 'You are helping a nursing-home acquisitions team with fairstay-acquisition-underwriting.\n\nRules: Fairstay Acquisition Underwriting does arithmetic on the files given. It is not an appraisal and never sends an offer.\n\n1. Call underwriting_check.\n2. Lead with missing months, rent coverage and the staffing gap, then the one-time items.\n3. Call underwriting_write_report for the investment committee.' },
});
