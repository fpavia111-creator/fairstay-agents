import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { checkPropco } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const LEASE = { aliases: ['Lease', 'Lease #', 'Lease Number', 'Lease ID', 'Agreement'], phi: 'account', required: true };
const PERIOD = { aliases: ['Period', 'Month', 'Rent Month'], required: true };
export const LEASE_FIELDS = Object.freeze({ lease_no: LEASE, operator: { aliases: ['Operator', 'Tenant', 'Lessee'], required: true }, facility: { aliases: ['Facility', 'Property', 'Building'] }, start: { aliases: ['Start', 'Commencement', 'Start Date'], type: 'date' }, end: { aliases: ['End', 'Expiration', 'End Date', 'Term End'], type: 'date' }, base_rent: { aliases: ['Base Rent', 'Monthly Rent', 'Initial Rent'], type: 'money', required: true }, escalator_pct: { aliases: ['Escalator', 'Escalator %', 'Annual Increase'], type: 'number' }, min_coverage: { aliases: ['Min Coverage', 'Rent Coverage Covenant', 'Coverage Minimum'], type: 'number' }, min_occupancy: { aliases: ['Min Occupancy', 'Occupancy Covenant'], type: 'number' }, financials_days: { aliases: ['Financials Days', 'Reporting Days', 'Financials Due Days'], type: 'number' }, rent_due_day: { aliases: ['Rent Due Day', 'Due Day'], type: 'number' } });
export const RENT_FIELDS = Object.freeze({ lease_no: LEASE, period: PERIOD, billed: { aliases: ['Billed', 'Rent Billed', 'Charged', 'Invoice Amount'], type: 'money' }, paid: { aliases: ['Paid', 'Received', 'Amount Paid', 'Collected'], type: 'money' }, paid_on: { aliases: ['Paid On', 'Received On', 'Payment Date'], type: 'date' } });
export const FIN_FIELDS = Object.freeze({ lease_no: LEASE, period: PERIOD, ebitdar: { aliases: ['EBITDAR', 'EBITDARM'], type: 'money' }, rent: { aliases: ['Rent', 'Rent Expense'], type: 'money' }, occupancy: { aliases: ['Occupancy', 'Occupancy %', 'Occ %'], type: 'number' }, received_on: { aliases: ['Received On', 'Received', 'Delivered'], type: 'date' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: { ending_warn_days: { type: 'integer', minimum: 30, maximum: 1095, description: 'Flag leases ending within this many days (default 365)' } } };
export const MEMORY_KINDS = Object.freeze({ lease_note: { description: 'A note on a lease, e.g. {"note": "Cedar Hollow guaranty is by the parent company, capped at 12 months rent"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  leases: fileArg('Leases under --root: lease number, operator, facility, start, end, base monthly rent, escalator percent, minimum rent coverage and occupancy, days to deliver financials, rent due day'),
  rent: fileArg('Rent roll under --root: lease, month, billed, paid, paid date'),
  financials: fileArg('Operator monthly financials under --root: lease, month, EBITDAR, rent, occupancy'),
  rules: fileArg('Optional rules JSON: ending_warn_days'),
  as_of: DATE_ARG('Review date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'propco_rules') : {}; return checkPropco(ctx.records(a.leases, 'leases'), ctx.records(a.rent, 'rent'), a.financials ? ctx.records(a.financials, 'financials') : [], { asOf: a.as_of || today(), endingWarnDays: r.ending_warn_days }); };
const summary = (o) => `${o.leases} lease(s); rent billed ${o.rent_billed}, collected ${o.rent_collected}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing to act on'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'propco', title: 'Fairstay PropCo Bookkeeping',
  description: 'Property company bookkeeping for nursing-home real estate: rent unpaid or short, escalators not billed, operator rent coverage and occupancy below the lease minimums, operator financials overdue and leases ending. Lease numbers are masked before results reach the model.',
  args, required: ['leases', 'rent'],
  sources: { leases: { label: 'Leases', args: ['leases'], fields: LEASE_FIELDS }, rent: { label: 'Rent roll', args: ['rent'], fields: RENT_FIELDS }, financials: { label: 'Operator financials', args: ['financials'], fields: FIN_FIELDS } },
  configSchemas: { propco_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Review the property company', description: 'Check rent, escalators, operator coverage and reporting for each lease.' },
  report: {
    title: { en: 'Property company lease review', es: 'Revisión de arrendamientos de la propietaria', de: 'Prüfung der Pachtverträge', fr: 'Revue des baux de la société immobilière', pt: 'Revisão de arrendamentos da proprietária', it: 'Revisione dei contratti di locazione', ja: '不動産会社リースレビュー', zh: '物业公司租约审查', ko: '부동산 회사 임대 검토' },
    base: 'propco',
    rows: (o) => o.items.map((i) => ({ status: i.status, lease_no: i.lease_no, operator: i.operator, facility: i.facility || '', period: i.period || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'operator', 'facility', 'period', 'amount', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Coverage uses EBITDAR / rent on the months the operator sent; your lease defines coverage and its definition wins.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'default_notice_send', category: 'binding_send', description: 'Fairstay PropCo Bookkeeping never sends default notices or letters to an operator.' }],
  prompt: { title: 'PropCo review', description: 'Walks the host model through the property company review with Fairstay PropCo Bookkeeping.', text: 'You are helping a nursing-home property company bookkeeper with fairstay-propco-bookkeeping.\n\nRules: Fairstay PropCo Bookkeeping reads files only. Lease numbers are masked.\n\n1. Call propco_check.\n2. Lead with unpaid rent and coverage below the lease.\n3. Call propco_write_report.' },
});
