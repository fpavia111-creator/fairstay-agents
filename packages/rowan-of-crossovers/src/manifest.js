import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, RESIDENT_ID, RESIDENT_NAME, DATE_FROM, DATE_TO, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { checkCrossovers } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const CLAIM = { aliases: ['Claim ID', 'Claim #', 'ICN', 'Medicare ICN', 'Claim Number', 'Original Claim', 'Medicare Claim'], required: true };
export const MEDICARE_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, claim_id: CLAIM, from: DATE_FROM(['Service From']), to: DATE_TO(['Service To']), days: { aliases: ['Days', 'Covered Days', 'Units'], type: 'number' }, medicare_paid: { aliases: ['Medicare Paid', 'Paid', 'Paid Amount', 'Payment'], type: 'money' }, coinsurance: { aliases: ['Coinsurance', 'Coins', 'Co-insurance', 'Patient Responsibility', 'PR Amount'], type: 'money', required: true }, deductible: { aliases: ['Deductible', 'Ded'], type: 'money' }, paid_on: { aliases: ['Paid On', 'Paid Date', 'Remit Date', 'Check Date'], type: 'date' }, dual: { aliases: ['Dual', 'Dual Eligible', 'Medicaid Secondary', 'QMB'] } });
export const CROSSOVER_FIELDS = Object.freeze({ claim_id: CLAIM, billed_coinsurance: { aliases: ['Billed Coinsurance', 'Billed', 'Crossover Billed', 'Billed Amount'], type: 'money' }, paid_amount: { aliases: ['Paid', 'Paid Amount', 'Medicaid Paid'], type: 'money' }, paid_on: { aliases: ['Paid On', 'Paid Date', 'Remit Date'], type: 'date' }, billed_on: { aliases: ['Billed On', 'Sent', 'Submitted', 'Crossover Date'], type: 'date' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  wait_days: { type: 'integer', minimum: 1, maximum: 180, description: 'Days after the Medicare payment before a missing crossover is flagged (default 30)' },
  response_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Days to wait for a Medicaid response to a crossover (default 45)' },
  medicaid_rate: { type: 'number', minimum: 0, description: 'Your Medicaid daily rate, for the lesser-of check' },
  lesser_of: { type: 'boolean', description: 'Whether your state pays crossovers lesser-of (default true)' },
} };
export const MEMORY_KINDS = Object.freeze({ state_crossover_rule: { description: 'How your state pays crossovers, e.g. {"note": "Texas pays lesser-of for nursing facility coinsurance"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  medicare: fileArg('Medicare claims or remits for residents under --root: claim id, service dates, days, Medicare paid, coinsurance, deductible, paid date, dual eligible flag'),
  crossovers: fileArg('Medicaid crossover claims under --root: Medicare claim id, billed coinsurance, Medicaid paid, paid date, billed date'),
  rules: fileArg('Optional rules JSON: wait_days, response_days, medicaid_rate, lesser_of'),
  as_of: DATE_ARG('Date to age from (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'rowan_rules') : {}; return checkCrossovers(ctx.records(a.medicare, 'medicare'), ctx.records(a.crossovers, 'crossovers'), { asOf: a.as_of || today(), waitDays: r.wait_days, responseDays: r.response_days, medicaidRate: r.medicaid_rate ?? null, useLesserOf: r.lesser_of ?? true }); };
const summary = (o) => `${o.dual_claims} dual-eligible claim(s) with ${o.cost_sharing} in Medicare cost sharing. ${o.not_crossed_over} never crossed over; ${o.bad_debt} for the bad debt log. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing to fix'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'rowan', title: 'Rowan of Crossovers',
  description: 'Medicare-to-Medicaid crossovers for dual-eligible nursing-home residents: coinsurance never crossed over, crossovers billed for the wrong amount, no Medicaid response, underpaid or zero-paid crossovers checked against the lesser-of rule, and unpaid cost sharing for the Medicare bad debt log. Resident identifiers are masked before results reach the model.',
  args, required: ['medicare', 'crossovers'],
  sources: { medicare: { label: 'Medicare claims', args: ['medicare'], fields: MEDICARE_FIELDS }, crossovers: { label: 'Medicaid crossovers', args: ['crossovers'], fields: CROSSOVER_FIELDS } },
  configSchemas: { rowan_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check crossovers', description: 'Match Medicare cost sharing to Medicaid crossovers and list what is missing, wrong or unpaid.' },
  report: {
    title: { en: 'Crossover and bad debt review', es: 'Revisión de crossovers y deudas incobrables', de: 'Crossover- und Forderungsausfallprüfung', fr: 'Revue des crossovers et créances irrécouvrables', pt: 'Revisão de crossovers e dívidas incobráveis', it: 'Revisione crossover e crediti inesigibili', ja: 'クロスオーバーと貸倒れのレビュー', zh: '交叉理赔与坏账审核', ko: '크로스오버 및 대손 검토' },
    base: 'rowan-crossovers',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, claim_id: i.claim_id || '', from: i.from, to: i.to, days: i.days, coinsurance: i.coinsurance, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'claim_id', 'from', 'to', 'coinsurance', 'amount', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Lesser-of and bad debt rules differ by state and change; confirm your state\'s crossover rule and your cost report preparer\'s bad debt rules.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'crossover_submit', category: 'binding_send', description: 'Rowan never submits claims to Medicaid.' }],
  prompt: { title: 'Crossover review', description: 'Walks the host model through a crossover review with Rowan.', text: 'You are helping a nursing-home business office with rowan-of-crossovers.\n\nRules: Rowan reads files only. Resident names and ids are pseudonyms.\n\n1. Call rowan_check.\n2. Lead with not_crossed_over and wrong_amount.\n3. List bad_debt_candidate totals for the cost report preparer.\n4. Call rowan_write_report.' },
});
