import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, MONTH_ARG, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { checkLiability } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const SCHEDULE_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  monthly_amount: { aliases: ['Monthly Amount', 'Liability', 'Patient Liability', 'Share of Cost', 'Applied Income', 'Monthly Liability'], type: 'money', required: true },
  effective_from: { aliases: ['Effective From', 'Effective Date', 'Start', 'From', 'Notice Effective'], type: 'date', required: true },
  effective_to: { aliases: ['Effective To', 'End Date', 'To', 'Thru'], type: 'date' } });
export const BILL_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  month: { aliases: ['Month', 'Billing Month', 'Period', 'Service Month'], required: true },
  amount: { aliases: ['Amount', 'Billed', 'Billed Amount', 'Charge'], type: 'money', required: true },
  kind: { aliases: ['Kind', 'Type', 'Charge Type', 'Description'] } });
export const PAY_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  date: { aliases: ['Date', 'Payment Date', 'Received', 'Deposit Date'], type: 'date', required: true },
  amount: { aliases: ['Amount', 'Payment', 'Paid', 'Payment Amount'], type: 'money', required: true } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  prorate: { type: 'boolean', description: 'Prorate the monthly liability for partial months in the building (default true; follow your state rule)' },
  unpaid_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Flag balances whose oldest unpaid bill is older than this (default 60)' },
} };
export const MEMORY_KINDS = Object.freeze({ collection_note: { description: 'A note about a payer or representative pattern, e.g. {"note": "Social Security deposits land on the 3rd"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  schedule: fileArg('Liability notices under --root: resident, monthly amount, effective from and to'),
  billing: fileArg('Resident billing under --root: resident, month (YYYY-MM), amount, kind (liability or private)'),
  payments: fileArg('Optional resident payments under --root: resident, date, amount'),
  census: fileArg('Optional census under --root, to prorate partial months'),
  rules: fileArg('Optional rules JSON: prorate, unpaid_days'),
  month: { ...MONTH_ARG, description: 'Billing month to check, YYYY-MM' },
  as_of: DATE_ARG('Date payments are counted to (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => {
  const r = a.rules ? ctx.readJson(a.rules, 'spruce_rules') : {};
  return checkLiability(ctx.records(a.schedule, 'schedule'), ctx.records(a.billing, 'billing'), a.payments ? ctx.records(a.payments, 'payments') : [], a.census ? ctx.records(a.census, 'census') : null, { month: a.month, asOf: a.as_of || today(), prorate: r.prorate ?? true, unpaidDays: r.unpaid_days ?? 60 });
};
const summary = (o) => `${o.residents_with_liability} resident(s) with a liability in ${o.month}. To bill ${o.amount_to_bill}; unpaid ${o.unpaid_total}; credits to refund ${o.credits_total}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'spruce', title: 'Spruce of Liability',
  description: 'Checks patient liability (Medicaid share of cost) and private-pay balances: liability not billed, billed short or over the current notice (prorated for partial months), unpaid balances by age, and credit balances to refund. Resident identifiers are masked before results reach the model.',
  args, required: ['schedule', 'billing', 'month'],
  sources: { schedule: { label: 'Liability notices', args: ['schedule'], fields: SCHEDULE_FIELDS }, billing: { label: 'Resident billing', args: ['billing'], fields: BILL_FIELDS }, payments: { label: 'Resident payments', args: ['payments'], fields: PAY_FIELDS }, census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS } },
  configSchemas: { spruce_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check liability and private pay', description: 'Compare liability notices with resident billing for a month, and list unpaid and credit balances.' },
  report: {
    title: { en: 'Patient liability and private pay', es: 'Responsabilidad del paciente y pago privado', de: 'Eigenanteil und Selbstzahler', fr: 'Participation du résident et paiement privé', pt: 'Responsabilidade do paciente e pagamento particular', it: 'Quota a carico e pagamento privato', ja: '自己負担と自費払い', zh: '患者自付与私人付款', ko: '본인 부담금과 자비 부담' },
    base: 'spruce-liability',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, month: i.month, expected: i.expected ?? '', billed: i.billed ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'expected', 'billed', 'amount', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Proration and refund timing follow your state\'s rules; set them in the rules file.', EVERGREEN_LIMITS.advice, EVERGREEN_LIMITS.phi],
  },
  refused: [{ name: 'statement_send', category: 'binding_send', description: 'Spruce never sends statements or letters to residents or families.' }, { name: 'refund_issue', category: 'move_money', description: 'Spruce never issues refunds.' }],
  prompt: { title: 'Liability review', description: 'Walks the host model through the monthly liability review with Spruce.', text: 'You are helping a nursing-home business office with spruce-of-liability.\n\nRules: Spruce reads files only; it never sends statements or refunds money. Resident names and ids are pseudonyms in results.\n\n1. Call spruce_check for the month.\n2. Lead with not_billed and underbilled (money to bill), then credit balances (refunds due), then unpaid balances.\n3. Call spruce_write_report.' },
});
