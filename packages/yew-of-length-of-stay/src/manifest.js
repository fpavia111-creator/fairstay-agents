import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { weeklyList } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const d = (aliases) => ({ aliases, type: 'date' });
export const STAY_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  last_covered_day: d(['Last Covered Day', 'Last Covered Date', 'Skilled End', 'Cut Date']), nomnc_given_on: d(['NOMNC Given', 'NOMNC Date', 'NOMNC Delivered', 'NOMNC']),
  planned_discharge: d(['Planned Discharge', 'Anticipated Discharge', 'Expected Discharge', 'Target Discharge']), last_review: d(['Last Review', 'Last Clinical Review', 'Last Meeting', 'Reviewed On']),
  skilled: { aliases: ['Skilled', 'Skilled Need', 'Still Skilled', 'Meets Skilled Criteria'] }, auth_end: d(['Auth End', 'Authorization End', 'Auth Through']),
  next_plan: { aliases: ['Next Plan', 'Plan', 'Discharge Plan', 'Next Payer'] }, part_a_days_used: { aliases: ['Part A Days Used', 'Prior SNF Days', 'Benefit Days Used'], type: 'number' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  review_days: { type: 'integer', minimum: 1, maximum: 30, description: 'Flag residents not reviewed for this many days (default 7)' },
  nomnc_warn_days: { type: 'integer', minimum: 0, maximum: 30, description: 'List NOMNCs due within this many days (default 5)' },
  day20_warn_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Warn this many days before Medicare day 20 (default 7)' },
  day100_warn_days: { type: 'integer', minimum: 0, maximum: 60, description: 'Warn this many days before Medicare day 100 (default 14)' },
  auth_warn_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Warn this many days before a managed care authorization ends (default 3)' },
} };
export const MEMORY_KINDS = Object.freeze({ meeting_note: { description: 'How the weekly meeting runs, e.g. {"note": "Tuesday 10am; therapy brings minutes"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  census: fileArg('Census under --root: residents, payers and dates'),
  stays: fileArg('Case management log under --root: last covered day, NOMNC date, planned discharge, last review, still skilled (Y/N), authorization end, next plan, Part A days used earlier'),
  rules: fileArg('Optional rules JSON: review_days, nomnc_warn_days, day20_warn_days, day100_warn_days, auth_warn_days'),
  as_of: DATE_ARG('Meeting date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'yew_rules') : {}; return weeklyList(ctx.records(a.census, 'census'), ctx.records(a.stays, 'stays'), { asOf: a.as_of || today(), reviewDays: r.review_days, nomncWarnDays: r.nomnc_warn_days, day20WarnDays: r.day20_warn_days, day100WarnDays: r.day100_warn_days, authWarnDays: r.auth_warn_days }); };
const summary = (o) => `${o.skilled_residents} resident(s) on Medicare A or managed care on ${o.as_of}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing for the meeting'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'yew', title: 'Yew of Length of Stay',
  description: 'The case management weekly meeting list for skilled nursing-home stays: late or due NOMNC notices, residents the team calls custodial still on a skilled payer, discharges past their date, clinical reviews overdue, managed care authorizations ending with no plan, and Medicare day 20 and day 100 coming up. Resident identifiers are masked before results reach the model.',
  args, required: ['census', 'stays'],
  sources: { census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, stays: { label: 'Case management log', args: ['stays'], fields: STAY_FIELDS } },
  configSchemas: { yew_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Build the weekly meeting list', description: 'List skilled residents who need a decision or a notice this week, most urgent first.' },
  report: {
    title: { en: 'Weekly skilled stay meeting list', es: 'Lista semanal de estancias especializadas', de: 'Wöchentliche Besprechungsliste', fr: 'Liste hebdomadaire des séjours qualifiés', pt: 'Lista semanal de internações especializadas', it: 'Elenco settimanale dei ricoveri', ja: '週次スキルド滞在会議リスト', zh: '每周专业护理住院会议清单', ko: '주간 전문 간호 회의 목록' },
    base: 'yew-weekly-meeting',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, payer: i.payer, days_left: i.days_left ?? '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'payer', 'days_left', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Notice rules (NOMNC two days before the last covered day) are summarised from public CMS material as of 2026; check current CMS instructions and your plans\' contracts.', EVERGREEN_LIMITS.advice, 'Whether care is skilled is a clinical decision made by the team, not by Yew.'],
  },
  refused: [{ name: 'notice_deliver', category: 'binding_send', description: 'Yew never delivers notices to residents or families.' }],
  prompt: { title: 'Weekly skilled meeting', description: 'Walks the host model through the weekly meeting list with Yew.', text: 'You are helping a nursing-home case manager prepare the weekly skilled meeting with yew-of-length-of-stay.\n\nRules: Yew reads files only. Resident names and ids are pseudonyms. Whether care is skilled is a clinical decision for the team.\n\n1. Call yew_check.\n2. Lead with nomnc_late and custodial_on_skilled.\n3. Call yew_write_report for the meeting.' },
});
