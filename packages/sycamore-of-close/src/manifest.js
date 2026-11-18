import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, RESIDENT_ID, RESIDENT_NAME, AMOUNT, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { checkClose } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ACCT = { aliases: ['Account', 'Account Number', 'GL Account', 'Acct', 'Account #'], required: true };
export const TB_FIELDS = Object.freeze({ entity: { aliases: ['Entity', 'Company', 'Facility', 'Building'] }, account: ACCT, name: { aliases: ['Name', 'Account Name', 'Description', 'Account Description'] }, activity: { aliases: ['Activity', 'Current Month', 'This Month', 'Net Change', 'Period Activity'], type: 'money' }, prior_activity: { aliases: ['Prior Activity', 'Prior Month', 'Last Month'], type: 'money' }, balance: { aliases: ['Balance', 'Ending Balance', 'YTD Balance', 'Closing Balance'], type: 'money', required: true } });
export const TASK_FIELDS = Object.freeze({ task: { aliases: ['Task', 'Step', 'Close Task', 'Description'], required: true }, owner: { aliases: ['Owner', 'Assigned To', 'Preparer'] }, due: { aliases: ['Due', 'Due Date', 'Day Due'], type: 'date' }, done_on: { aliases: ['Done', 'Done On', 'Completed', 'Completed On'], type: 'date' } });
export const SUSPENSE_FIELDS = Object.freeze({ account: ACCT, date: { aliases: ['Date', 'Posted', 'Entry Date'], type: 'date' }, amount: AMOUNT, resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, memo: { aliases: ['Memo', 'Description', 'Reference'], phi: 'free_text' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  patient_days: { type: 'integer', minimum: 1, description: 'Patient days this month, for per-patient-day checks' },
  swing_pct: { type: 'number', minimum: 0, description: 'Flag month-over-month moves above this percent (default 25)' },
  swing_min: { type: 'number', minimum: 0, description: '...and at least this amount (default 5000)' },
  accruals: { type: 'array', description: 'Accounts that need activity every month', items: { type: 'object', additionalProperties: false, required: ['account', 'min'], properties: { account: { type: 'string', description: 'GL account' }, name: { type: 'string', description: 'Name' }, min: { type: 'number', minimum: 0, description: 'Least expected each month' } } } },
  ppd: { type: 'array', description: 'Usual per-patient-day ranges', items: { type: 'object', additionalProperties: false, required: ['account'], properties: { account: { type: 'string', description: 'GL account' }, low: { type: 'number', description: 'Low end' }, high: { type: 'number', description: 'High end' } } } },
} };
export const MEMORY_KINDS = Object.freeze({ swing_explanation: { description: 'A known reason for a swing, e.g. {"account": "6100", "note": "annual insurance renewal in July"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['account', 'note'], properties: { account: { type: 'string', minLength: 1, maxLength: 40 }, note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  tb: fileArg('Trial balance under --root: entity, account, name, this month\'s activity, last month\'s activity, ending balance'),
  tasks: fileArg('Optional close checklist under --root: task, owner, due date, done date'),
  suspense: fileArg('Optional suspense and unapplied cash detail under --root: account, date, amount, resident, memo'),
  rules: fileArg('Optional rules JSON: patient_days, swing_pct, swing_min, accruals, ppd ranges'),
  as_of: DATE_ARG('Close date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'sycamore_rules') : {}; return checkClose(ctx.records(a.tb, 'tb'), { asOf: a.as_of || today(), patientDays: r.patient_days, swingPct: r.swing_pct, swingMin: r.swing_min, accruals: r.accruals, ppd: r.ppd, tasks: a.tasks ? ctx.records(a.tasks, 'tasks') : [], suspense: a.suspense ? ctx.records(a.suspense, 'suspense') : [] }); };
const summary = (o) => `${o.accounts} account(s) in ${o.entities} entit(ies); ${o.tasks_open} close task(s) open. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Ready to close'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'sycamore', title: 'Sycamore of Close',
  description: 'Month-end close checks for nursing homes: trial balance out of balance, intercompany that does not net, suspense and unapplied cash balances, missing recurring accruals, late close tasks, big month-over-month swings and per-patient-day costs outside their usual range. Resident names in suspense detail are masked before results reach the model.',
  args, required: ['tb'],
  sources: { tb: { label: 'Trial balance', args: ['tb'], fields: TB_FIELDS }, tasks: { label: 'Close checklist', args: ['tasks'], fields: TASK_FIELDS }, suspense: { label: 'Suspense detail', args: ['suspense'], fields: SUSPENSE_FIELDS } },
  configSchemas: { sycamore_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check the close', description: 'Run the month-end close checks, blocking problems first.' },
  report: {
    title: { en: 'Month-end close review', es: 'Revisión del cierre mensual', de: 'Monatsabschlussprüfung', fr: 'Revue de clôture mensuelle', pt: 'Revisão do fechamento mensal', it: 'Revisione della chiusura mensile', ja: '月次決算レビュー', zh: '月末结账审核', ko: '월말 결산 검토' },
    base: 'sycamore-close',
    rows: (o) => o.items.map((i) => ({ status: i.status, entity: i.entity || '', account: i.account || '', name: i.name || '', amount: i.amount, task_owner: i.owner || '', due_date: i.due_date || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'entity', 'account', 'name', 'amount', 'message', 'fix'],
  },
  refused: [{ name: 'journal_post', category: 'binding_send', description: 'Sycamore never posts journal entries to the general ledger.' }],
  prompt: { title: 'Close review', description: 'Walks the host model through the month-end close with Sycamore.', text: 'You are helping a nursing-home controller close the month with sycamore-of-close.\n\nRules: Sycamore reads files only. A person posts entries.\n\n1. Call sycamore_check.\n2. Lead with out_of_balance, intercompany and suspense.\n3. Then missing accruals and late tasks.\n4. Call sycamore_write_report.' },
});
