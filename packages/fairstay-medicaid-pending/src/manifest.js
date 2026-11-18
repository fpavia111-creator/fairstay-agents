import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { checkPending } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const d = (aliases) => ({ aliases, type: 'date' });
export const APP_FIELDS = Object.freeze({
  resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  applied_on: { ...d(['Applied On', 'Application Date', 'Date Applied', 'Filed On', 'Submitted']), required: true },
  status: { aliases: ['Status', 'Application Status', 'Medicaid Status'], required: true },
  last_contact: d(['Last Contact', 'Last Follow Up', 'Last Follow-up', 'Last Call', 'Follow Up Date']),
  docs_requested: { aliases: ['Docs Requested', 'Documents Requested', 'RFI Items', 'Requested Items'] },
  docs_received: { aliases: ['Docs Received', 'Documents Received', 'Received Items'] },
  docs_due: d(['Docs Due', 'RFI Due', 'Documents Due', 'Due Date']),
  decision_date: d(['Decision Date', 'Notice Date', 'Determination Date']),
  effective_date: d(['Effective Date', 'Coverage Start', 'Approved From', 'Eligibility Date']),
  billed_through: d(['Billed Through', 'Billed Thru', 'Last Billed']),
  patient_liability: { aliases: ['Patient Liability', 'Share of Cost', 'Applied Income', 'Resident Liability'], type: 'money' },
  appeal_filed: d(['Appeal Filed', 'Fair Hearing Requested', 'Hearing Request Date']),
  pending_balance: { aliases: ['Pending Balance', 'Balance', 'AR Balance', 'Unbilled Amount', 'Pending AR'], type: 'money' },
});
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  decision_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Days the state has to decide (default 45; 90 when disability is decided)' },
  followup_days: { type: 'integer', minimum: 1, maximum: 120, description: 'Flag when the caseworker has not been contacted for this many days (default 14)' },
  appeal_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Days after a denial to ask for a fair hearing in your state (default 30; set your state\'s number)' },
  docs_warn_days: { type: 'integer', minimum: 0, maximum: 60, description: 'Warn this many days before requested documents are due (default 7)' },
} };
export const MEMORY_KINDS = Object.freeze({
  caseworker_note: {
    description: 'A note about the state office or a caseworker, e.g. {"note": "County office answers email within 2 days; faxes get lost"}.',
    effect: 'is shown with results. It never changes a check.',
    schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } },
  },
});
const args = {
  applications: fileArg('Medicaid application log under --root: resident, applied on, status, last contact, documents requested/received/due, decision and effective dates, billed through, patient liability, appeal filed, pending balance'),
  census: fileArg('Optional census under --root, to find Medicaid pending residents with no application'),
  rules: fileArg('Optional rules JSON: decision_days, followup_days, appeal_days, docs_warn_days'),
  as_of: DATE_ARG('Date to check on (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => {
  const r = a.rules ? ctx.readJson(a.rules, 'pending_rules') : {};
  return checkPending(ctx.records(a.applications, 'applications'), { asOf: a.as_of || today(), decisionDays: r.decision_days, followupDays: r.followup_days, appealDays: r.appeal_days, docsWarnDays: r.docs_warn_days, census: a.census ? ctx.records(a.census, 'census') : null });
};
const summary = (o) => `${o.open} open application(s) of ${o.applications}, oldest ${o.oldest_days} days, ${o.pending_balance} pending. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'pending', title: 'Fairstay Medicaid Pending',
  description: 'Tracks Medicaid pending applications for nursing-home residents: pending residents with no application, decisions past the state deadline, requested documents overdue or due soon, no caseworker contact, approvals not yet billed, approvals with no patient liability set, and denials whose appeal window is closing or closed, with the pending balance by age. Resident identifiers are masked before results reach the model.',
  args, required: ['applications'],
  sources: { applications: { label: 'Medicaid application log', args: ['applications'], fields: APP_FIELDS }, census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS } },
  configSchemas: { pending_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check Medicaid pending', description: 'List Medicaid pending problems, most urgent first, with the pending balance by age.' },
  report: {
    title: { en: 'Medicaid pending tracker', es: 'Seguimiento de Medicaid pendiente', de: 'Übersicht ausstehende Medicaid-Anträge', fr: 'Suivi des demandes Medicaid en attente', pt: 'Acompanhamento do Medicaid pendente', it: 'Monitoraggio Medicaid in attesa', ja: 'メディケイド申請中の追跡', zh: '医疗补助待审跟踪', ko: '메디케이드 심사 중 추적' },
    base: 'pending-medicaid-pending',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, applied_on: i.applied_on || '', days_pending: i.days_pending ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'applied_on', 'days_pending', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Pending balance by age (days since applied)' }, rows: Object.entries(o.pending_balance_by_age).map(([age, amount]) => ({ age, amount })), columns: ['age', 'amount'] }],
    limits: [EVERGREEN_LIMITS.files, 'Deadlines are the numbers in your rules file; decision times and appeal windows differ by state.', EVERGREEN_LIMITS.advice, EVERGREEN_LIMITS.phi],
  },
  refused: [{ name: 'medicaid_application_submit', category: 'binding_send', description: 'Fairstay Medicaid Pending never files applications or documents with the state.' }, { name: 'email_send', category: 'binding_send', description: 'Fairstay Medicaid Pending never emails caseworkers or families.' }],
  prompt: { title: 'Medicaid pending review', description: 'Walks the host model through the weekly Medicaid pending meeting with Fairstay Medicaid Pending.', text: 'You are helping a nursing-home business office run the weekly Medicaid pending meeting with fairstay-medicaid-pending.\n\nRules: Fairstay Medicaid Pending reads files only and never files anything or emails anyone. Resident names and ids are pseudonyms in results.\n\n1. Call pending_check with the application log, the census and as_of.\n2. Lead with not_applied and appeal deadlines, then documents overdue and decisions overdue.\n3. Then approvals not billed (cash the home can collect now).\n4. Call pending_write_report for the meeting.' },
});
