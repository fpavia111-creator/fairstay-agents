import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { trackChow } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const STEP_FIELDS = Object.freeze({ step: { aliases: ['Step', 'Task', 'Item', 'Description'], required: true }, area: { aliases: ['Area', 'Category', 'Workstream', 'Agency'] }, owner: { aliases: ['Owner', 'Responsible', 'Assigned To'] }, due: { aliases: ['Due', 'Due Date', 'Deadline'], type: 'date' }, days_before_close: { aliases: ['Days Before Close', 'Lead Days', 'Days Before Closing'], type: 'number' }, done_on: { aliases: ['Done', 'Done On', 'Completed', 'Filed On'], type: 'date' }, blocked_by: { aliases: ['Blocked By', 'Depends On', 'Waiting On'] }, contact_email: { aliases: ['Contact Email', 'Agency Contact', 'Email'], phi: 'email' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, required: ['close_date'], properties: { close_date: { type: 'string', format: 'date', description: 'Planned closing (effective) date' }, warn_days: { type: 'integer', minimum: 1, maximum: 90, description: 'Flag steps due within this many days (default 14)' } } };
export const MEMORY_KINDS = Object.freeze({ chow_note: { description: 'A note on this state or contractor, e.g. {"note": "state license reviewer asks for audited financials of the buyer"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  steps: fileArg('CHOW checklist under --root: step, area, owner, due date or days before close, done date, blocked by, agency contact'),
  deal: fileArg('Deal JSON: close_date, warn_days'),
  as_of: DATE_ARG('Status date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const d = ctx.readJson(a.deal, 'olive_deal'); return trackChow(ctx.records(a.steps, 'steps'), { asOf: a.as_of || today(), closeDate: d.close_date, warnDays: d.warn_days }); };
const summary = (o) => `${o.done} of ${o.steps} step(s) done; ${o.days_to_close} days to closing on ${o.close_date}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ')}.`;

export const manifest = snfAgent({
  pkg, prefix: 'olive', title: 'Olive of CHOW',
  description: 'Change of ownership (CHOW) tracker for nursing homes: every step for Medicare, Medicaid, the state license, payers, banking, payroll, insurance and vendors against the closing date, with late steps, blocked steps, steps due soon and standard steps missing from your list. Agency contact details are masked before results reach the model.',
  args, required: ['steps', 'deal'],
  sources: { steps: { label: 'CHOW checklist', args: ['steps'], fields: STEP_FIELDS } },
  configSchemas: { olive_deal: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Track the CHOW', description: 'Check the CHOW checklist against the closing date and the standard steps.' },
  report: {
    title: { en: 'Change of ownership tracker', es: 'Seguimiento del cambio de titularidad', de: 'Betreiberwechsel-Tracker', fr: 'Suivi du changement de propriétaire', pt: 'Acompanhamento da mudança de titularidade', it: 'Monitoraggio cambio di proprietà', ja: '所有権変更トラッカー', zh: '所有权变更跟踪', ko: '소유권 변경 추적' },
    base: 'olive-chow',
    rows: (o) => o.items.map((i) => ({ status: i.status, area: i.area || '', step: i.step, step_owner: i.step_owner || '', due: i.due || '', days_left: i.days_left ?? '', contact_email: i.contact_email || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'area', 'step', 'step_owner', 'due', 'days_left', 'message'],
    limits: [EVERGREEN_LIMITS.files, 'Lead times are typical, not rules; your state, the Medicare contractor and each payer set their own. A healthcare attorney runs the transaction.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'agency_filing_submit', category: 'binding_send', description: 'Olive never files anything with CMS, a Medicare contractor or a state.' }],
  prompt: { title: 'CHOW status', description: 'Walks the host model through a CHOW status meeting with Olive.', text: 'You are helping a nursing-home transaction team with olive-of-chow.\n\nRules: Olive reads files only. A healthcare attorney runs the deal.\n\n1. Call olive_check.\n2. Lead with late and blocked steps, then missing standard steps.\n3. Call olive_write_report for the weekly call.' },
});
