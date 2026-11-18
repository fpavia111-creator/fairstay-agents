import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, MONTH_ARG, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, PAYER, PAYER_TYPE, LEVEL, DATE_FROM, DATE_TO, EVERGREEN_LIMITS } from 'fairstay-core';
import { compareCensus, periodOf } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const BILLING_FIELDS = Object.freeze({
  resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  claim_id: { aliases: ['Claim', 'Claim ID', 'Claim #', 'Invoice', 'Invoice #', 'Batch'], translate: false },
  payer: { ...PAYER, required: true }, payer_type: PAYER_TYPE, level: LEVEL,
  from: { ...DATE_FROM(['Service From', 'Statement From', 'From DOS']), required: true },
  to: DATE_TO(['Service To', 'Statement Thru', 'Thru DOS']),
  days: { aliases: ['Days', 'Units', 'Covered Days', 'Billed Days', 'Qty'], type: 'number' },
  amount: { aliases: ['Amount', 'Charges', 'Billed Amount', 'Total Charges', 'Charge'], type: 'money' },
});

const RATE = { type: 'object', additionalProperties: false, required: ['rate'], properties: { payer: { type: 'string' }, payer_type: { type: 'string' }, level: { type: 'string' }, rate: { type: 'number', minimum: 0 }, from: { type: 'string' }, to: { type: 'string' } } };
const RATES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  rates: { type: 'array', maxItems: 5000, items: RATE, description: 'Per-diem rates by payer (or payer type) and level' },
  bed_hold_payers: { type: 'array', maxItems: 200, items: { type: 'string' }, description: 'Payer names or payer types that pay leave and hospital (bed-hold) days' },
} };

export const MEMORY_KINDS = Object.freeze({
  bed_hold_payer: {
    description: 'A payer that pays leave or hospital bed-hold days, learned from a contract or a state rule, e.g. {"payer": "Lone Star Medicaid (fictional)", "note": "pays up to 3 hospital leave days"}.',
    effect: 'treats that payer\'s leave and hospital days as billable, so they show as unbilled when missing and are not flagged when billed.',
    schema: { type: 'object', additionalProperties: false, required: ['payer'], properties: { payer: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', maxLength: 300 } } },
  },
});

const args = {
  census: fileArg('Census export under --root (CSV, Excel, JSON): one row per stretch of a stay with resident, payer, level, bed status, from and to (the to day is not counted)'),
  billing: fileArg('Billed days under --root: claim or invoice lines with resident, payer, service from and through (inclusive), days, level and amount'),
  rates: fileArg('Optional rates JSON: per-diem rates by payer and level, and the payers that pay bed-hold days'),
  month: MONTH_ARG,
  start: DATE_ARG('Start of the period (YYYY-MM-DD) if not a whole month'),
  end: DATE_ARG('End of the period, inclusive (YYYY-MM-DD)'),
};

const run = (a, ctx) => {
  const p = periodOf(a);
  const cfg = a.rates ? ctx.readJson(a.rates, 'census_rates') : {};
  const facts = ctx.memoryFacts('bed_hold_payer').map((f) => f.value.payer);
  return compareCensus(ctx.records(a.census, 'census'), ctx.records(a.billing, 'billing'), { start: p.start, end: p.end, rates: cfg.rates || [], bedHoldPayers: [...(cfg.bed_hold_payers || []), ...facts] });
};
const summary = (o) => `${o.residents} resident(s), ${o.census_days} census days (${o.billable_days} billable), ${o.billed_days} billed days. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}. Revenue at risk ${o.revenue_at_risk}; billed without a census day ${o.overbilled}.`;

export const manifest = snfAgent({
  pkg, prefix: 'census', title: 'Fairstay Census Billing',
  description: 'Compares the nursing-home census with what was billed, day by day: days billed to the wrong payer, census days not billed, days billed with no census, leave days billed to a payer that does not pay bed holds, duplicate days, overlapping census rows, levels and per-diem rates that differ from your rate table. Resident identifiers are masked before results reach the model.',
  args, required: ['census', 'billing'],
  sources: { census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, billing: { label: 'Billed days', args: ['billing'], fields: BILLING_FIELDS } },
  configSchemas: { census_rates: RATES_SCHEMA }, memoryKinds: MEMORY_KINDS,
  run, summary,
  check: { title: 'Census against billing', description: 'Compare the census and the billed days for a month (or start to end) and list each run of days that differs, with the dollars at risk.' },
  report: {
    title: { en: 'Census and billing reconciliation', es: 'Conciliación de censo y facturación', de: 'Abgleich Belegung und Abrechnung', fr: 'Rapprochement recensement et facturation', pt: 'Conciliação de censo e faturamento', it: 'Riconciliazione censimento e fatturazione', ja: '在籍とレセプトの照合', zh: '在院人数与账单核对', ko: '재원 현황과 청구 대사' },
    base: 'census',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, from: i.from, to: i.to, days: i.days, payer: i.payer, billed_payer: i.billed_payer || '', level: i.level || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'from', 'to', 'days', 'payer', 'billed_payer', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [EVERGREEN_LIMITS.files, 'Census days follow the midnight census: the discharge day is not counted. Billed service dates are read as inclusive.', EVERGREEN_LIMITS.advice, EVERGREEN_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Fairstay Census Billing never submits or voids claims; the billing office does.' },
    { name: 'census_update', category: 'production_deploy', description: 'Fairstay Census Billing never changes the census in PointClickCare or any other system.' },
  ],
  prompt: { title: 'Reconcile census and billing', description: 'Walks the host model through a month-end census reconciliation with Fairstay Census Billing.', text: `You are helping a nursing-home business office manager with fairstay-census-billing.

Rules: Fairstay Census Billing only reads files. It never submits claims or edits the census. Resident names and ids are pseudonyms in results.

1. Call census_check with the census, the billed days and the month.
2. Lead with wrong_payer and unbilled (money at risk), then billed_not_in_census and bed_hold_billed (money that may be taken back).
3. For census_overlap, say the census must be fixed before billing.
4. If a payer pays bed-hold days and the rates file does not say so, offer census_learn (kind bed_hold_payer).
5. Call census_write_report for the business office.` },
});
