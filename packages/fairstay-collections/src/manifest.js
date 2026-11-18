import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, RESIDENT_ID, RESIDENT_NAME, PAYER, PAYER_TYPE, DATE_FROM, DATE_TO, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { checkCollections, BUCKETS } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const AR_FIELDS = Object.freeze({
  resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: { ...PAYER, required: true }, payer_type: PAYER_TYPE,
  claim_id: { aliases: ['Claim ID', 'Claim #', 'Invoice', 'Invoice #', 'ICN', 'Claim Number', 'Reference'] },
  from: DATE_FROM(['Service From', 'Service Date', 'DOS From']), to: DATE_TO(['Service To', 'DOS To']),
  billed_on: { aliases: ['Billed', 'Billed On', 'Bill Date', 'Billed Date', 'Submitted', 'Submit Date'], type: 'date' },
  balance: { aliases: ['Balance', 'Open Balance', 'Outstanding', 'Amount Due', 'Balance Due', 'Amount'], type: 'money', required: true },
  last_follow_up: { aliases: ['Last Follow Up', 'Last Follow-up', 'Follow Up Date', 'Last Contact', 'Last Worked'], type: 'date' },
  note: { aliases: ['Note', 'Notes', 'Status', 'Claim Status', 'Comment', 'Denial Reason'], phi: 'free_text' },
});
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  follow_up_days: { type: 'integer', minimum: 1, maximum: 180, description: 'Flag balances not worked for this many days (default 30)' },
  warn_days: { type: 'integer', minimum: 1, maximum: 180, description: 'Warn this many days before a filing limit (default 30)' },
  bill_lag_days: { type: 'integer', minimum: 0, maximum: 90, description: 'Days after service before an unbilled balance is flagged (default 10)' },
  filing_days: { type: 'object', description: 'Filing limit in days by payer type, from your payer contracts and state rules', additionalProperties: { type: 'integer', minimum: 1, maximum: 1095 } },
} };
export const MEMORY_KINDS = Object.freeze({ filing_limit: { description: 'A payer-specific filing limit confirmed from a contract, e.g. {"payer_type": "managed_care", "days": 120}.', effect: 'is listed with results for staff to copy into the rules file. It never changes a check by itself.', schema: { type: 'object', additionalProperties: false, required: ['payer_type', 'days'], properties: { payer_type: { type: 'string', description: 'Payer type' }, days: { type: 'integer', minimum: 1, maximum: 1095 } } } } });
const args = {
  ar: fileArg('Open receivables (aged trial balance) under --root: resident, payer, service dates, billed date, balance, last follow-up, status note'),
  rules: fileArg('Optional rules JSON: follow_up_days, warn_days, bill_lag_days, filing_days'),
  as_of: DATE_ARG('Aging date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'collections_rules') : {}; return checkCollections(ctx.records(a.ar, 'ar'), { asOf: a.as_of || today(), followUpDays: r.follow_up_days, warnDays: r.warn_days, billLagDays: r.bill_lag_days, filingDays: r.filing_days }); };
const summary = (o) => `${o.open_accounts} open account(s), ${o.total_ar} receivable as of ${o.as_of}, ${o.over_90} over 90 days. ${o.at_risk} at risk from filing limits and denials. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing stuck'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'collections', title: 'Fairstay Collections',
  description: 'Nursing-home collections: ages open receivables by payer type and says why each account is stuck (filing limit missed or near, credit balance, denial, no follow-up, not billed, Medicaid pending), as a monthly status report. Resident identifiers are masked before results reach the model.',
  args, required: ['ar'],
  sources: { ar: { label: 'Open receivables', args: ['ar'], fields: AR_FIELDS } },
  configSchemas: { collections_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check collections', description: 'Age open receivables by payer type and list stuck accounts, most urgent first.' },
  report: {
    title: { en: 'Collections status report', es: 'Informe de estado de cobranzas', de: 'Inkasso-Statusbericht', fr: 'Rapport de recouvrement', pt: 'Relatório de cobranças', it: 'Rapporto sullo stato degli incassi', ja: '回収状況レポート', zh: '催收状况报告', ko: '수금 현황 보고서' },
    base: 'collections',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, payer: i.payer, payer_type: i.payer_type, claim_id: i.claim_id || '', from: i.from, to: i.to, age_days: i.age_days, balance: i.balance, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'payer', 'to', 'age_days', 'balance', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Aging by payer type' }, rows: o.aging, columns: ['payer_type', ...BUCKETS, 'total'] }],
  },
  refused: [{ name: 'claim_write_off', category: 'money_movement', description: 'Fairstay Collections never writes off, adjusts or refunds a balance.' }, { name: 'payer_portal_login', category: 'credentials', description: 'Fairstay Collections does not log in to payer portals.' }],
  prompt: { title: 'Monthly collections review', description: 'Walks the host model through a collections review with Fairstay Collections.', text: 'You are helping a nursing-home business office review collections with fairstay-collections.\n\nRules: Fairstay Collections reads files only. Resident names and ids are pseudonyms. A person decides write-offs and refunds.\n\n1. Call collections_check.\n2. Lead with timely_filing_missed and timely_filing_at_risk, then credit balances.\n3. Show the aging table by payer type.\n4. Call collections_write_report for the monthly status report.' },
});
