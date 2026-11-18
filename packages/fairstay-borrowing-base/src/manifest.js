import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, RESIDENT_ID, RESIDENT_NAME, PAYER, PAYER_TYPE, PAYER_TYPES, AMOUNT, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { borrowingBase } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const AR_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: { ...PAYER, required: true }, payer_type: PAYER_TYPE, service_date: { aliases: ['Service Date', 'Service To', 'Through', 'Invoice Date', 'DOS', 'Bill Date'], type: 'date' }, balance: { ...AMOUNT, aliases: ['Balance', 'Open Balance', 'Outstanding', 'Amount'], required: true } });
const byType = (item, description) => ({ type: 'object', propertyNames: { enum: [...PAYER_TYPES, 'default'] }, additionalProperties: item, description });
const TERMS_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  advance_rates: byType({ type: 'number', minimum: 0, maximum: 1 }, 'Advance rate by payer type, from your loan agreement'),
  max_age_days: byType({ type: 'integer', minimum: 1, maximum: 730 }, 'Age limit in days by payer type, plus default'),
  cross_age_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Cross-aging percent (default 50)' },
  concentration_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Most one managed care or commercial payer may be of eligible receivables, percent (default 25)' },
  ineligible_types: { type: 'array', description: 'Payer types that are never eligible', items: { type: 'string', enum: PAYER_TYPES } },
  line_limit: { type: 'number', minimum: 0, description: 'Line of credit commitment' },
  outstanding: { type: 'number', minimum: 0, description: 'Loan balance today' },
} };
export const MEMORY_KINDS = Object.freeze({ lender_note: { description: 'A note on the lender\'s rules, e.g. {"note": "certificate due the 15th; lender excludes VA"}.', effect: 'is shown with results. It never changes the base.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  ar: fileArg('Aged receivables by resident under --root: resident, payer, payer type, service or invoice date, balance'),
  terms: fileArg('Loan terms JSON: advance rates, age limits, cross-aging, concentration, ineligible payer types, line limit, loan balance'),
  as_of: DATE_ARG('Certificate date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => borrowingBase(ctx.records(a.ar, 'ar'), { asOf: a.as_of || today(), terms: a.terms ? ctx.readJson(a.terms, 'borrowing_terms') : {} });
const summary = (o) => `Gross receivables ${o.gross_ar}, ineligible ${o.ineligible}, eligible ${o.eligible}. Borrowing base ${o.borrowing_base}${o.line_limit !== null ? ` on a ${o.line_limit} line` : ''}; loan ${o.outstanding}; available ${o.available}.`;

export const manifest = snfAgent({
  pkg, prefix: 'borrowing', title: 'Fairstay Borrowing Base',
  description: 'Prepares a nursing-home borrowing base certificate from aged receivables: eligible receivables by payer type, ineligibles by reason (over age, cross-aged, Medicaid pending, credit balances, payer concentration), availability at your advance rates and the room left on the line. Arithmetic on your loan terms. Resident identifiers are masked before results reach the model.',
  args, required: ['ar'],
  sources: { ar: { label: 'Aged receivables', args: ['ar'], fields: AR_FIELDS } },
  configSchemas: { borrowing_terms: TERMS_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Prepare the borrowing base', description: 'Work out eligible receivables, ineligibles by reason and availability for the certificate.' },
  report: {
    title: { en: 'Borrowing base certificate support', es: 'Soporte del certificado de base de préstamo', de: 'Unterlagen zur Borrowing-Base', fr: 'Justificatif de base d\'emprunt', pt: 'Suporte do certificado de base de empréstimo', it: 'Supporto al certificato di borrowing base', ja: '借入ベース証明書の裏付け', zh: '借款基数证明支持', ko: '차입 기준 증명서 근거' },
    base: 'borrowing-base',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id || '', resident_name: i.resident_name || '', payer: i.payer || '', payer_type: i.payer_type || '', date: i.date || '', age_days: i.age_days ?? '', amount: i.amount, message: i.message })),
    htmlColumns: ['status', 'resident_name', 'payer', 'age_days', 'amount', 'message'],
    sections: (o) => [{ title: { en: 'Availability by payer type' }, rows: o.by_payer_type, columns: ['payer_type', 'gross', 'ineligible', 'eligible', 'advance_rate', 'availability'] }, { title: { en: 'Ineligibles by reason' }, rows: Object.entries(o.ineligibles).map(([reason, amount]) => ({ reason, amount })), columns: ['reason', 'amount'] }, { title: { en: 'Certificate' }, rows: [{ borrowing_base: o.borrowing_base, line_limit: o.line_limit ?? '', outstanding: o.outstanding, available: o.available }], columns: ['borrowing_base', 'line_limit', 'outstanding', 'available'] }],
    limits: [EVERGREEN_LIMITS.files, 'Eligibility follows the terms you give it; your loan agreement and the lender\'s field examiner decide what counts.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'certificate_submit', category: 'binding_send', description: 'Fairstay Borrowing Base never signs or sends a certificate to a lender.' }, { name: 'line_draw', category: 'money_movement', description: 'Fairstay Borrowing Base never draws on the line.' }],
  prompt: { title: 'Borrowing base certificate', description: 'Walks the host model through the borrowing base with Fairstay Borrowing Base.', text: 'You are helping a nursing-home controller with fairstay-borrowing-base.\n\nRules: Fairstay Borrowing Base is arithmetic on the loan terms given. A person signs the certificate.\n\n1. Call borrowing_check with the aging and the terms.\n2. Give availability and the biggest ineligible reasons.\n3. Call borrowing_write_report as certificate support.' },
});
