import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, MONTH_ARG, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, EVERGREEN_LIMITS, monthBounds, payerKey } from 'fairstay-core';
import { checkPayerSource } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const RESIDENT_FIELDS = Object.freeze({
  resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  secondary_payer: { aliases: ['Secondary Payer', 'Secondary', 'Secondary Insurance', 'Coinsurance Payer', 'Supplemental'] },
  responsible_party: { aliases: ['Responsible Party', 'Guarantor', 'Financially Responsible', 'POA', 'Billing Contact'] },
  hospice_agency: { aliases: ['Hospice', 'Hospice Agency', 'Hospice Provider'] },
  part_a_days_used: { aliases: ['Part A Days Used', 'Prior SNF Days', 'Benefit Days Used'], type: 'number' },
});
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  payers: { type: 'array', maxItems: 2000, items: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1 }, type: { type: 'string' } } }, description: 'Your payer list (names as they appear on the census)' },
  coinsurance_rate: { type: 'number', minimum: 0, description: 'Medicare SNF daily coinsurance for days 21-100 for the year (set it from the current CMS notice)' },
} };
export const MEMORY_KINDS = Object.freeze({
  payer_alias: {
    description: 'Another spelling of a payer on your list, e.g. {"alias": "LS Medicaid", "payer": "Lone Star Medicaid (fictional)"}.',
    effect: 'treats the alias as a known payer, so it is not flagged as unknown_payer. It never changes other checks.',
    schema: { type: 'object', additionalProperties: false, required: ['alias', 'payer'], properties: { alias: { type: 'string', minLength: 1, maxLength: 120 }, payer: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', maxLength: 300 } } },
  },
});
const args = {
  census: fileArg('Census export under --root (rows with resident, payer, from, to; the to day is not counted)'),
  residents: fileArg('Optional resident financial file under --root: secondary payer, responsible party, hospice agency, Part A days used earlier in the benefit period'),
  rules: fileArg('Optional rules JSON: your payer list and the daily coinsurance rate'),
  month: MONTH_ARG, start: DATE_ARG('Start of the period (YYYY-MM-DD) if not a whole month'), end: DATE_ARG('End of the period, inclusive'),
};
const run = (a, ctx) => {
  const p = a.month ? monthBounds(a.month) : (a.start && a.end ? { start: a.start, end: a.end } : null);
  if (!p) throw new Error('give month (YYYY-MM) or start and end');
  const r = a.rules ? ctx.readJson(a.rules, 'payer_rules') : {};
  const aliases = ctx.memoryFacts('payer_alias').map((f) => ({ name: f.value.alias }));
  return checkPayerSource(ctx.records(a.census, 'census'), { start: p.start, end: p.end, payers: r.payers ? [...r.payers, ...aliases] : null, residents: a.residents ? ctx.records(a.residents, 'residents') : [], coinsuranceRate: r.coinsurance_rate ?? null });
};
const summary = (o) => `${o.residents} resident(s), ${o.resident_days} resident days, ${o.days_with_findings} day(s) with a payer problem. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings'}.${o.coinsurance_at_risk ? ` Coinsurance with no secondary payer: ${o.coinsurance_at_risk}.` : ''}`;

export const manifest = snfAgent({
  pkg, prefix: 'payer', title: 'Fairstay Payer Source',
  description: 'Checks that every nursing-home resident day has one proper payer: days with no payer, two payers on one day, payers not on your payer list, Medicare Part A past day 100, Part A coinsurance days with no secondary payer, hospice residents on Part A, and private pay with no responsible party. Resident identifiers are masked before results reach the model.',
  args, required: ['census'],
  sources: { census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, residents: { label: 'Resident financial file', args: ['residents'], fields: RESIDENT_FIELDS } },
  configSchemas: { payer_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check payer source for every day', description: 'List runs of resident days with a missing, doubled, unknown or improper payer for a month (or start to end).' },
  report: {
    title: { en: 'Payer source work list', es: 'Lista de trabajo de fuente de pago', de: 'Arbeitsliste Kostenträger', fr: 'Liste de travail des payeurs', pt: 'Lista de trabalho de fonte pagadora', it: 'Elenco di lavoro dei pagatori', ja: '支払者確認作業リスト', zh: '付款方核查工作清单', ko: '지불자 확인 작업 목록' },
    base: 'payer-source',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, payer: i.payer || '', from: i.from, to: i.to, days: i.days, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'payer', 'from', 'to', 'days', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Part A day counts use the census plus the earlier days you supply; the Common Working File is the record.', EVERGREEN_LIMITS.rules, EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'census_update', category: 'production_deploy', description: 'Fairstay Payer Source never changes payers in PointClickCare or any other system.' }],
  prompt: { title: 'Payer source review', description: 'Walks the host model through the payer source review with Fairstay Payer Source.', text: 'You are helping a business office manager with fairstay-payer-source.\n\nRules: Fairstay Payer Source reads files only. Resident names and ids are pseudonyms in results.\n\n1. Call payer_check for the month.\n2. Lead with no_payer and payer_overlap (nothing can be billed), then part_a_over_100.\n3. For unknown_payer that is a spelling, offer payer_learn (kind payer_alias).\n4. Call payer_write_report.' },
});
