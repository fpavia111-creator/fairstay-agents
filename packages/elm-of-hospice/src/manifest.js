import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, MONTH_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, PAYER, DATE_FROM, DATE_TO, AMOUNT, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { checkHospice } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const HOSPICE = { aliases: ['Hospice', 'Hospice Provider', 'Hospice Agency', 'Hospice Name'] };
export const HOSPICE_CENSUS_FIELDS = Object.freeze({ ...CENSUS_FIELDS, hospice: HOSPICE });
export const INVOICE_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, hospice: { ...HOSPICE, required: true }, invoice_id: { aliases: ['Invoice', 'Invoice #', 'Invoice Number', 'Invoice ID'] }, from: { ...DATE_FROM(['Service From']), required: true }, to: DATE_TO(['Service To']), days: { aliases: ['Days', 'Units', 'Room and Board Days'], type: 'number' }, amount: { ...AMOUNT, aliases: ['Amount', 'Invoice Amount', 'Billed', 'Total'] }, invoice_date: { aliases: ['Invoice Date', 'Billed On', 'Date Sent'], type: 'date' }, paid_amount: { aliases: ['Paid', 'Paid Amount', 'Payment', 'Amount Paid'], type: 'money' }, paid_on: { aliases: ['Paid On', 'Payment Date', 'Check Date'], type: 'date' } });
export const CONTRACT_FIELDS = Object.freeze({ hospice: { ...HOSPICE, required: true }, rate: { aliases: ['Rate', 'Daily Rate', 'Room and Board Rate', 'Per Diem'], type: 'money', required: true }, from: DATE_FROM(), to: DATE_TO(['Expires', 'Expiration Date']), pay_days: { aliases: ['Pay Days', 'Payment Terms', 'Net Days'], type: 'number' } });
export const CLAIM_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: { ...PAYER, required: true }, from: { ...DATE_FROM(['Service From']), required: true }, to: DATE_TO(['Service To']) });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: { pay_days: { type: 'integer', minimum: 1, maximum: 180, description: 'Days a hospice has to pay when the contract does not say (default 30)' } } };
export const MEMORY_KINDS = Object.freeze({ hospice_alias: { description: 'Another name the census uses for a contracted hospice, e.g. {"alias": "BHH", "hospice": "Bluebonnet Hospice"}.', effect: 'is listed with results so staff can fix the census or contract file. It never changes a check by itself.', schema: { type: 'object', additionalProperties: false, required: ['alias', 'hospice'], properties: { alias: { type: 'string', minLength: 1, maxLength: 120 }, hospice: { type: 'string', minLength: 1, maxLength: 120 } } } } });
const args = {
  census: fileArg('Census under --root, with a Hospice column or hospice payer rows'),
  invoices: fileArg('Room and board invoices to hospices under --root: resident, hospice, service dates, days, amount, invoice date, paid amount'),
  contracts: fileArg('Hospice contracts under --root: hospice, daily rate, effective dates, payment terms'),
  claims: fileArg('Optional Medicaid claim lines under --root, to catch hospice days billed to Medicaid directly'),
  rules: fileArg('Optional rules JSON: pay_days'),
  month: MONTH_ARG,
  as_of: DATE_ARG('Date to age unpaid invoices from (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'elm_rules') : {}; if (!/^\d{4}-\d{2}$/.test(a.month || '')) throw new Error('month must be YYYY-MM'); return checkHospice(ctx.records(a.census, 'census'), ctx.records(a.invoices, 'invoices'), ctx.records(a.contracts, 'contracts'), a.claims ? ctx.records(a.claims, 'claims') : [], { month: a.month, asOf: a.as_of || today(), payDays: r.pay_days }); };
const summary = (o) => `${o.hospice_residents} hospice resident(s), ${o.hospice_days} hospice day(s) in ${o.month}. ${o.not_invoiced} not invoiced, ${o.unpaid} unpaid past terms. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing to fix'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'elm', title: 'Elm of Hospice',
  description: 'Hospice room and board for nursing-home residents: hospice days not invoiced to the hospice, invoiced days not on the census, invoices below the contract rate, unpaid invoices past terms, hospices with no contract and Medicaid billed directly for hospice days. Resident identifiers are masked before results reach the model.',
  args, required: ['census', 'invoices', 'contracts', 'month'],
  sources: { census: { label: 'Census', args: ['census'], fields: HOSPICE_CENSUS_FIELDS }, invoices: { label: 'Hospice invoices', args: ['invoices'], fields: INVOICE_FIELDS }, contracts: { label: 'Hospice contracts', args: ['contracts'], fields: CONTRACT_FIELDS }, claims: { label: 'Medicaid claims', args: ['claims'], fields: CLAIM_FIELDS } },
  configSchemas: { elm_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check hospice room and board', description: 'Compare hospice census days, room and board invoices, contracts and Medicaid claims for a month.' },
  report: {
    title: { en: 'Hospice room and board review', es: 'Revisión de alojamiento y comida de hospicio', de: 'Hospiz-Unterkunft und Verpflegung', fr: 'Hébergement des patients en soins palliatifs', pt: 'Revisão de hospedagem de hospice', it: 'Vitto e alloggio hospice', ja: 'ホスピス室料・食費レビュー', zh: '安宁疗护食宿审核', ko: '호스피스 숙식비 검토' },
    base: 'elm-hospice',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id || '', resident_name: i.resident_name || '', hospice: i.hospice, invoice_id: i.invoice_id || '', from: i.from, to: i.to, days: i.days, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'hospice', 'from', 'to', 'days', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
  },
  refused: [{ name: 'hospice_invoice_send', category: 'binding_send', description: 'Elm never sends invoices or statements to a hospice.' }],
  prompt: { title: 'Monthly hospice review', description: 'Walks the host model through a hospice room and board review with Elm.', text: 'You are helping a nursing-home business office with elm-of-hospice.\n\nRules: Elm reads files only. Resident names and ids are pseudonyms.\n\n1. Call elm_check for the month.\n2. Lead with medicaid_billed_directly (a repayment risk), then not_invoiced.\n3. Call elm_write_report.' },
});
