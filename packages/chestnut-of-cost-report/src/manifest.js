import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, CENSUS_FIELDS, EVERGREEN_LIMITS, today } from 'evergreen-core';
import { tieOut } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const CR_FIELDS = Object.freeze({ payer_type: { aliases: ['Payer Type', 'Program', 'Title', 'Line', 'Payer'], required: true }, days: { aliases: ['Days', 'Patient Days', 'Inpatient Days', 'Census Days'], type: 'number', required: true } });
export const PSR_FIELDS = Object.freeze({ days: { aliases: ['Days', 'Covered Days', 'Utilization Days', 'Paid Days'], type: 'number', required: true } });
export const PBC_FIELDS = Object.freeze({ item: { aliases: ['Item', 'Request', 'Description', 'PBC Item'], required: true }, requested_by: { aliases: ['Requested By', 'Requester', 'For'] }, owner: { aliases: ['Owner', 'Assigned To', 'Preparer'] }, due: { aliases: ['Due', 'Due Date'], type: 'date' }, received_on: { aliases: ['Received', 'Sent', 'Provided On', 'Done'], type: 'date' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: { tolerance_days: { type: 'integer', minimum: 0, maximum: 100, description: 'Allowed difference in days (default 0)' }, count_leave_days: { type: 'boolean', description: 'Count leave and hospital hold days as patient days (default true; follow your state and cost report instructions)' } } };
export const MEMORY_KINDS = Object.freeze({ tie_out_note: { description: 'A known reconciling item, e.g. {"note": "3 hospice days in January moved after the census closed"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  census: fileArg('Census for the fiscal year under --root'),
  cost_report: fileArg('Cost report draft days under --root: payer type (medicare_a, medicaid, other, total) and days'),
  psr: fileArg('Optional PS&R summary under --root: Medicare Part A covered days'),
  pbc: fileArg('Optional prepared-by-client list under --root: item, requested by, owner, due, received'),
  rules: fileArg('Optional rules JSON: tolerance_days, count_leave_days'),
  start: DATE_ARG('First day of the fiscal year (YYYY-MM-DD)'),
  end: DATE_ARG('Last day of the fiscal year (YYYY-MM-DD)'),
  as_of: DATE_ARG('Date for PBC deadlines (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'chestnut_rules') : {}; return tieOut(ctx.records(a.census, 'census'), ctx.records(a.cost_report, 'cost_report'), a.psr ? ctx.records(a.psr, 'psr') : [], a.pbc ? ctx.records(a.pbc, 'pbc') : [], { start: a.start, end: a.end, asOf: a.as_of || today(), tolerance: r.tolerance_days, countLeaveDays: r.count_leave_days ?? true }); };
const summary = (o) => `${o.total_days} census patient days from ${o.start} to ${o.end} (Medicare A ${o.census_days_by_group.medicare_a}, Medicaid ${o.census_days_by_group.medicaid}, other ${o.census_days_by_group.other}); ${o.pbc_open} PBC item(s) open. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Days tie out'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'chestnut', title: 'Chestnut of Cost Report',
  description: 'Cost report and audit support for nursing homes: patient days by payer tied out between the census, the cost report draft and the Medicare PS&R, and the prepared-by-client list for auditors, the bank and the Medicare contractor with overdue and due-soon items. Resident identifiers are masked before results reach the model.',
  args, required: ['census', 'cost_report', 'start', 'end'],
  sources: { census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, cost_report: { label: 'Cost report days', args: ['cost_report'], fields: CR_FIELDS }, psr: { label: 'PS&R', args: ['psr'], fields: PSR_FIELDS }, pbc: { label: 'PBC list', args: ['pbc'], fields: PBC_FIELDS } },
  configSchemas: { chestnut_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Tie out patient days', description: 'Tie patient days by payer between the census, the cost report draft and the PS&R, and list PBC items due.' },
  report: {
    title: { en: 'Cost report days tie-out', es: 'Conciliación de días del informe de costos', de: 'Abstimmung der Pflegetage', fr: 'Rapprochement des journées patients', pt: 'Conciliação de dias do relatório de custos', it: 'Riconciliazione giornate paziente', ja: 'コストレポート患者日数照合', zh: '成本报告病人日核对', ko: '원가 보고서 환자일 대사' },
    base: 'chestnut-tie-out',
    rows: (o) => o.items.map((i) => ({ status: i.status, group: i.group || '', item: i.item || '', census_days: i.census_days ?? '', other_days: i.other_days ?? '', due_date: i.due_date || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'group', 'item', 'census_days', 'other_days', 'due_date', 'message'],
    sections: (o) => [{ title: { en: 'Patient days tie-out' }, rows: o.tie_out, columns: ['group', 'census_days', 'cost_report_days', 'difference'] }],
    limits: [EVERGREEN_LIMITS.files, 'Which days count (leave days, hospice, Medicare Advantage) follows Medicare and state cost report instructions; your preparer decides.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'cost_report_file', category: 'binding_send', description: 'Chestnut never files a cost report or sends anything to a Medicare contractor.' }],
  prompt: { title: 'Cost report tie-out', description: 'Walks the host model through the days tie-out with Chestnut.', text: 'You are helping a nursing-home controller with chestnut-of-cost-report.\n\nRules: Chestnut reads files only. Resident names and ids are pseudonyms.\n\n1. Call chestnut_check for the fiscal year.\n2. Tie total days first, then by payer, then the PS&R.\n3. List overdue PBC items.\n4. Call chestnut_write_report.' },
});
