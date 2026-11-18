import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { planNextPayer } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const PLAN_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  next_payer: { aliases: ['Next Payer', 'Planned Payer', 'Future Payer', 'Payer Plan'] },
  part_a_days_used: { aliases: ['Part A Days Used', 'Prior SNF Days', 'Benefit Days Used'], type: 'number' },
  auth_end: { aliases: ['Auth End', 'Authorization End', 'Auth Through', 'Auth Expires'], type: 'date' },
  private_funds: { aliases: ['Private Funds', 'Funds Available', 'Assets', 'Bank Balance'], type: 'money' },
  daily_rate: { aliases: ['Daily Rate', 'Private Rate', 'Per Diem'], type: 'money' },
  monthly_income: { aliases: ['Monthly Income', 'Income', 'Social Security', 'Pension'], type: 'money' },
  medicaid_applied_on: { aliases: ['Medicaid Applied', 'Medicaid Applied On', 'Application Date'], type: 'date' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  horizon_days: { type: 'integer', minimum: 1, maximum: 180, description: 'Look this many days ahead (default 30)' },
  apply_lead_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Flag private-pay residents this many days before funds run out with no Medicaid application (default 90)' },
} };
export const MEMORY_KINDS = Object.freeze({ planning_note: { description: 'A note on how this home plans payer changes, e.g. {"note": "family meeting is every Tuesday at 2"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  census: fileArg('Census under --root: residents, payers and dates'),
  plans: fileArg('Resident payer plans under --root: next payer, Part A days used earlier, managed care authorization end, private funds, daily rate, monthly income, Medicaid application date'),
  rules: fileArg('Optional rules JSON: horizon_days, apply_lead_days'),
  as_of: DATE_ARG('Date to plan from (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'hemlock_rules') : {}; return planNextPayer(ctx.records(a.census, 'census'), ctx.records(a.plans, 'plans'), { asOf: a.as_of || today(), horizonDays: r.horizon_days, applyLeadDays: r.apply_lead_days }); };
const summary = (o) => `${o.residents} resident(s) in the building on ${o.as_of}; looking ${o.horizon_days} days ahead. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing runs out soon'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'hemlock', title: 'Hemlock of Next Payer',
  description: 'Plans the next payer for long-stay nursing-home residents: when Medicare Part A day 100 falls, when a managed care authorization ends, and when private funds run out, flagging residents with no next payer planned and private-pay residents who should start a Medicaid application now. Resident identifiers are masked before results reach the model.',
  args, required: ['census', 'plans'],
  sources: { census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, plans: { label: 'Payer plans', args: ['plans'], fields: PLAN_FIELDS } },
  configSchemas: { hemlock_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Plan next payers', description: 'List residents whose current payer runs out soon, soonest first, and whether the next payer is planned.' },
  report: {
    title: { en: 'Next payer planning list', es: 'Lista de planificación del próximo pagador', de: 'Planung nächster Kostenträger', fr: 'Planification du prochain payeur', pt: 'Planejamento do próximo pagador', it: 'Pianificazione del prossimo pagatore', ja: '次の支払者計画リスト', zh: '下一付款方规划清单', ko: '다음 지불자 계획 목록' },
    base: 'hemlock-next-payer',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, payer: i.payer, runs_out_on: i.runs_out_on, days_left: i.days_left, next_payer: i.next_payer || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'payer', 'runs_out_on', 'days_left', 'next_payer', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Part A day 100 assumes every day stays covered; skilled care can end sooner. Funds run-out is arithmetic on the numbers in the plan file.', EVERGREEN_LIMITS.estimate, EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'family_letter_send', category: 'binding_send', description: 'Hemlock never writes to residents or families.' }],
  prompt: { title: 'Next payer planning', description: 'Walks the host model through next-payer planning with Hemlock.', text: 'You are helping a nursing-home business office plan payer changes with hemlock-of-next-payer.\n\nRules: Hemlock reads files only. Resident names and ids are pseudonyms in results. Never give legal or Medicaid planning advice; suggest the family talks to an elder law attorney when assets are involved.\n\n1. Call hemlock_check.\n2. Lead with plan_needed (soonest first), then apply_medicaid.\n3. Call hemlock_write_report for the weekly meeting.' },
});
