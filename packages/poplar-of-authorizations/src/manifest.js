import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, PAYER, LEVEL, DATE_FROM, DATE_TO, PAYER_TYPES, today } from 'evergreen-core';
import { checkAuthorizations } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const AUTH_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: PAYER, auth_number: { aliases: ['Auth #', 'Auth Number', 'Authorization', 'Authorization Number', 'Auth ID', 'Reference #'], required: true }, from: { ...DATE_FROM(['Auth From', 'Auth Start']), required: true }, to: DATE_TO(['Auth To', 'Auth End', 'Expiration Date']), level: LEVEL, days_authorized: { aliases: ['Days Authorized', 'Authorized Days', 'Days Approved', 'Approved Days', 'Units'], type: 'number' }, next_review: { aliases: ['Next Review', 'Review Date', 'Next Review Date', 'Concurrent Review'], type: 'date' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  warn_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Flag authorizations ending within this many days (default 3)' },
  review_warn_days: { type: 'integer', minimum: 0, maximum: 30, description: 'Flag concurrent reviews due within this many days (default 2)' },
  auth_payer_types: { type: 'array', description: 'Payer types that need an authorization (default managed_care)', items: { type: 'string', enum: PAYER_TYPES } },
} };
export const MEMORY_KINDS = Object.freeze({ plan_review_rule: { description: 'A plan\'s review habit, e.g. {"payer": "Sunrise HMO", "note": "reviews every 7 days, faxed clinicals only"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['payer', 'note'], properties: { payer: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  census: fileArg('Census under --root: residents, payers, levels and dates'),
  auths: fileArg('Authorization log under --root: resident, payer, authorization number, from, to, level, days authorized, next review'),
  rules: fileArg('Optional rules JSON: warn_days, review_warn_days, auth_payer_types'),
  start: DATE_ARG('First census day to check (YYYY-MM-DD, default the first of the as_of month)'),
  as_of: DATE_ARG('Last census day to check and the date to look ahead from (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'poplar_rules') : {}; const asOf = a.as_of || today(); return checkAuthorizations(ctx.records(a.census, 'census'), ctx.records(a.auths, 'auths'), { start: a.start || `${asOf.slice(0, 8)}01`, asOf, warnDays: r.warn_days, reviewWarnDays: r.review_warn_days, authTypes: r.auth_payer_types }); };
const summary = (o) => `${o.residents} resident(s) on a payer that needs an authorization, ${o.auth_days} day(s) from ${o.start} to ${o.as_of}; ${o.days_without_auth} day(s) with no authorization. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Every day is covered'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'poplar', title: 'Poplar of Authorizations',
  description: 'Managed care authorizations against the nursing-home census: days with no authorization, levels that differ from the authorized level, days past the authorized count, authorizations about to end with no next one, and concurrent reviews due or overdue. Resident identifiers are masked before results reach the model.',
  args, required: ['census', 'auths'],
  sources: { census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, auths: { label: 'Authorization log', args: ['auths'], fields: AUTH_FIELDS } },
  configSchemas: { poplar_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check authorizations', description: 'Match each managed care census day to an authorization and list gaps, then authorizations ending and reviews due.' },
  report: {
    title: { en: 'Authorization worklist', es: 'Lista de trabajo de autorizaciones', de: 'Genehmigungs-Arbeitsliste', fr: 'Liste des autorisations', pt: 'Lista de autorizações', it: 'Elenco autorizzazioni', ja: '承認ワークリスト', zh: '授权工作清单', ko: '승인 작업 목록' },
    base: 'poplar-authorizations',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, payer: i.payer, auth_number: i.auth_number || '', level: i.level || '', from: i.from, to: i.to, days: i.days ?? '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'payer', 'auth_number', 'from', 'to', 'message', 'fix'],
  },
  refused: [{ name: 'plan_portal_submit', category: 'binding_send', description: 'Poplar never submits authorization requests or clinicals to a plan.' }],
  prompt: { title: 'Daily authorization check', description: 'Walks the host model through the daily authorization check with Poplar.', text: 'You are helping a nursing-home case manager with poplar-of-authorizations.\n\nRules: Poplar reads files only. Resident names and ids are pseudonyms.\n\n1. Call poplar_check.\n2. Lead with no_auth and over_authorized_days.\n3. Then reviews overdue and authorizations ending.\n4. Call poplar_write_report.' },
});
