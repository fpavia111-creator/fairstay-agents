import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, RESIDENT_ID, RESIDENT_NAME, PAYER, PAYER_TYPE, DATE_FROM, DATE_TO, AMOUNT, PAYER_TYPES, EVERGREEN_LIMITS, findItem, today } from 'fairstay-core';
import { checkAppeals } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const d = (aliases) => ({ aliases, type: 'date' });
export const DENIAL_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: { ...PAYER, required: true }, payer_type: PAYER_TYPE,
  claim_id: { aliases: ['Claim ID', 'Claim #', 'ICN', 'Claim Number'], required: true }, from: DATE_FROM(['Service From']), to: DATE_TO(['Service To']), amount: { ...AMOUNT, aliases: ['Amount', 'Denied Amount', 'Billed', 'Balance'] },
  denied_on: { ...d(['Denied On', 'Denial Date', 'Remit Date', 'Notice Date']), required: true }, reason: { aliases: ['Reason', 'Denial Reason', 'Reason Code', 'Remark'], translate: false },
  level: { aliases: ['Level', 'Appeal Level', 'Current Level'], type: 'number' }, filed_on: d(['Filed On', 'Appeal Filed', 'Appeal Date', 'Submitted']), decided_on: d(['Decided On', 'Decision Date']), decision: { aliases: ['Decision', 'Outcome', 'Result'] } });
const LEVEL = { type: 'object', additionalProperties: false, required: ['name', 'file_days', 'decide_days'], properties: { name: { type: 'string', description: 'Level name' }, file_days: { type: 'integer', minimum: 1, maximum: 730, description: 'Days to file, from the denial or last decision' }, decide_days: { type: 'integer', minimum: 1, maximum: 730, description: 'Days the payer has to decide' } } };
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  warn_days: { type: 'integer', minimum: 1, maximum: 90, description: 'Flag appeals due within this many days (default 14)' },
  levels: { type: 'object', description: 'Appeal levels by payer type, replacing the defaults for that type', propertyNames: { enum: PAYER_TYPES }, additionalProperties: { type: 'array', items: LEVEL } },
  facility_name: { type: 'string', description: 'Facility name for appeal letters' },
} };
export const MEMORY_KINDS = Object.freeze({ appeal_tip: { description: 'What worked with a payer, e.g. {"payer": "Sunrise HMO", "note": "attach therapy minutes; fax only"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['payer', 'note'], properties: { payer: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  denials: fileArg('Denial log under --root: resident, payer, claim, service dates, amount, denial date, reason, appeal level filed, filed date, decision date, decision'),
  rules: fileArg('Optional rules JSON: warn_days, levels by payer type, facility_name'),
  as_of: DATE_ARG('Date to count deadlines from (YYYY-MM-DD, default today)'),
};
const rules = (a, ctx) => (a.rules ? ctx.readJson(a.rules, 'appeals_rules') : {});
const run = (a, ctx) => { const r = rules(a, ctx); return checkAppeals(ctx.records(a.denials, 'denials'), { asOf: a.as_of || today(), warnDays: r.warn_days, levels: r.levels }); };
const summary = (o) => `${o.open_denials} open denial(s) worth ${o.open_amount}; ${o.due_soon_amount} due to appeal soon; ${o.lost_amount} past the deadline. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing open'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'appeals', title: 'Fairstay Denial Appeals',
  description: 'Denial appeals for nursing homes: the next appeal level and its deadline for each open denial by payer type, appeals due soon, windows already closed, decisions overdue, and an appeal letter draft a person checks, approves with one click and sends. Resident identifiers are masked before results reach the model.',
  args, required: ['denials'],
  sources: { denials: { label: 'Denial log', args: ['denials'], fields: DENIAL_FIELDS } },
  configSchemas: { appeals_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check appeal deadlines', description: 'List open denials with the next appeal level and deadline, most urgent first.' },
  report: {
    title: { en: 'Appeals deadline list', es: 'Lista de plazos de apelación', de: 'Widerspruchsfristen', fr: 'Échéances des recours', pt: 'Prazos de recurso', it: 'Scadenze dei ricorsi', ja: '不服申立て期限リスト', zh: '申诉截止日期清单', ko: '이의신청 기한 목록' },
    base: 'appeals',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, payer: i.payer, claim_id: i.claim_id || '', amount: i.amount, reason: i.reason || '', next_level: i.level_name || '', deadline: i.deadline || i.decision_due || '', days_left: i.days_left ?? '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'payer', 'claim_id', 'amount', 'next_level', 'deadline', 'message'],
    limits: [EVERGREEN_LIMITS.files, 'Medicare appeal timeframes are summarised from public CMS material as of 2026; Medicaid and managed care levels are placeholders until you set them from your state rules and contracts. Deadlines usually run from the date the notice was received.', EVERGREEN_LIMITS.advice],
  },
  drafts: {
    noun: 'appeal_letter', verb: 'send', category: 'binding_send', actor: 'your business office manager',
    title: 'Draft an appeal letter',
    description: 'Write an appeal letter for one open denial at its next level, with the deadline, the denial reason and a list of the records to attach. Clinical arguments are left as markers for the clinical team. Marked DRAFT; nothing is sent.',
    args: { ...args, claim_id: { type: 'string', description: 'Claim id from appeals_check' } }, required: ['denials', 'claim_id'],
    build: (a, ctx) => {
      const r = rules(a, ctx); const out = run(a, ctx);
      const it = findItem(out.items, 'claim_id', a.claim_id, ctx, { kind: 'claim', label: 'claim' });
      if (!it.deadline) throw new Error(`claim ${a.claim_id} has no appeal to file (${it.status}): ${it.message}`);
      if (it.status === 'appeal_window_closed') throw new Error(`the ${it.level_name} deadline for claim ${a.claim_id} passed on ${it.deadline}; ask about a good-cause extension instead of drafting a late appeal`);
      return { id: String(it.claim_id), to: it.payer, amount: it.amount, text: `**To:** ${it.payer} appeals unit [CHECK: appeals address or portal]\n**From:** ${r.facility_name || '[MISSING: facility name]'}\n**Re:** ${it.level_name} for claim ${it.claim_id}\n**Resident:** ${it.resident_name || it.resident_id} [CHECK: member id]\n**Dates of service:** ${it.from || '[MISSING]'} to ${it.to || it.from || '[MISSING]'}\n**Amount denied:** ${it.amount}\n**File by:** ${it.deadline}\n\nWe request a ${it.level_name.toLowerCase()} of the denial of this claim${it.reason ? ` (reason given: ${it.reason})` : ''}.\n\n[MISSING: why the services met coverage rules, written by the clinical team]\n\nPlease reprocess the claim for payment.\n\n[ATTACH: denial notice]\n[ATTACH: physician orders and certifications]\n[ATTACH: MDS assessments for the dates]\n[ATTACH: therapy minutes and nursing notes]\n[ATTACH: authorization, if a managed care plan]\n\nSigned: [MISSING: name and title]\n` };
    },
  },
  refused: [{ name: 'appeal_submit', category: 'binding_send', description: 'Fairstay Denial Appeals never submits appeals; a person sends an approved letter.' }],
  prompt: { title: 'Denial meeting', description: 'Walks the host model through the denial meeting with Fairstay Denial Appeals.', text: 'You are helping a nursing-home business office with fairstay-denial-appeals.\n\nRules: Fairstay Denial Appeals reads files and writes drafts only. Resident names and ids are pseudonyms. Clinical arguments come from the clinical team.\n\n1. Call appeals_check.\n2. Lead with appeal_due_soon and decision_overdue.\n3. Offer appeals_draft_appeal_letter for each due-soon claim; a person reviews and approves it.\n4. Call appeals_write_report.' },
});
