import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, PAYER, PAYER_TYPE, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { checkEligibility } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const ELIG_FIELDS = Object.freeze({
  resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: { ...PAYER, required: true }, payer_type: PAYER_TYPE,
  status: { aliases: ['Status', 'Eligibility', 'Eligibility Status', 'Coverage Status', 'Result'] },
  checked_on: { aliases: ['Checked On', 'Verified On', 'Verification Date', 'Check Date', 'Date Checked', 'Last Verified'], type: 'date' },
  coverage_from: { aliases: ['Coverage From', 'Eligible From', 'Effective Date', 'Start'], type: 'date' },
  coverage_to: { aliases: ['Coverage To', 'Eligible To', 'Term Date', 'Termination Date', 'End'], type: 'date' },
  part_a_days_used: { aliases: ['Part A Days Used', 'SNF Days Used', 'Benefit Days Used', 'Days Used'], type: 'number' },
  renewal_date: { aliases: ['Renewal Date', 'Redetermination Date', 'Recertification Date', 'Review Date'], type: 'date' },
});
export const STAY_FIELDS = Object.freeze({
  resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  hospital_admit: { aliases: ['Hospital Admit', 'Hospital Admission', 'Inpatient Admit', 'Acute Admit Date'], type: 'date', required: true },
  hospital_discharge: { aliases: ['Hospital Discharge', 'Inpatient Discharge', 'Acute Discharge Date'], type: 'date', required: true },
  snf_admit: { aliases: ['SNF Admit', 'Admit Date', 'Admission Date', 'Facility Admit'], type: 'date' },
  waiver: { aliases: ['Waiver', '3 Day Waiver', 'Three Day Waiver', 'QHS Waiver'] },
});

const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  stale_days: { type: 'integer', minimum: 1, maximum: 365, description: 'A check older than this many days is stale (default 30)' },
  warn_days: { type: 'integer', minimum: 0, maximum: 120, description: 'Warn this many days before coverage or Part A days run out (default 14)' },
  renewal_warn_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Warn this many days before a Medicaid renewal (default 60)' },
} };

export const MEMORY_KINDS = Object.freeze({
  qualifying_stay_waiver: {
    description: 'A managed care plan or program that waives the 3-day hospital stay, e.g. {"payer": "Gulf Coast Advantage HMO (fictional)", "note": "plan contract waives the 3-day stay"}.',
    effect: 'notes the waiver on that payer\'s residents in results. Part A residents are still checked; it never removes a check.',
    schema: { type: 'object', additionalProperties: false, required: ['payer'], properties: { payer: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', maxLength: 300 } } },
  },
});

const args = {
  census: fileArg('Census export under --root: residents, payer and dates (the residents in the building on as_of are checked)'),
  eligibility: fileArg('Eligibility results under --root: resident, payer, status, date checked, coverage dates, Part A days used, Medicaid renewal date'),
  stays: fileArg('Optional hospital stays under --root: resident, hospital admit and discharge, SNF admit, waiver'),
  rules: fileArg('Optional rules JSON: stale_days, warn_days, renewal_warn_days'),
  as_of: DATE_ARG('Date to check on (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => {
  const r = a.rules ? ctx.readJson(a.rules, 'eligibility_rules') : {};
  const out = checkEligibility(ctx.records(a.census, 'census'), ctx.records(a.eligibility, 'eligibility'), a.stays ? ctx.records(a.stays, 'stays') : [], { asOf: a.as_of || today(), staleDays: r.stale_days, warnDays: r.warn_days, renewalWarnDays: r.renewal_warn_days });
  const waivers = ctx.memoryFacts('qualifying_stay_waiver');
  for (const i of out.items) { const w = waivers.find((f) => String(f.value.payer).toLowerCase() === String(i.payer).toLowerCase()); if (w) i.waiver_note = `${w.value.payer}: ${w.value.note || 'waiver on file'} (fact ${w.id})`; }
  return out;
};
const summary = (o) => `${o.residents} resident(s) in the building on ${o.as_of}; ${o.findings} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'eligibility', title: 'Fairstay Eligibility Checks',
  description: 'Checks eligibility for every nursing-home resident in the building: missing or stale checks, inactive or ended coverage still on the census, coverage ending soon, Medicare Part A benefit days running out, missing or short qualifying hospital stays, admissions more than 30 days after the hospital, and Medicaid renewals due. Resident identifiers are masked before results reach the model.',
  args, required: ['census', 'eligibility'],
  sources: { census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, eligibility: { label: 'Eligibility results', args: ['eligibility'], fields: ELIG_FIELDS }, stays: { label: 'Hospital stays', args: ['stays'], fields: STAY_FIELDS } },
  configSchemas: { eligibility_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check resident eligibility', description: 'List eligibility problems for the residents in the building on as_of, most urgent first.' },
  report: {
    title: { en: 'Resident eligibility work list', es: 'Lista de trabajo de elegibilidad de residentes', de: 'Arbeitsliste Anspruchsprüfung Bewohner', fr: 'Liste de travail d\'éligibilité des résidents', pt: 'Lista de trabalho de elegibilidade dos residentes', it: 'Elenco di lavoro idoneità residenti', ja: '入居者の資格確認作業リスト', zh: '住户资格核查工作清单', ko: '입소자 자격 확인 작업 목록' },
    base: 'eligibility',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, payer: i.payer, days_left: i.days_left ?? '', checked_on: i.checked_on || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'payer', 'days_left', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Medicare Part A SNF rules used: 100 benefit days per benefit period, a 3-day inpatient qualifying stay (discharge day not counted) and admission within 30 days, unless a waiver applies. Check current CMS guidance.', EVERGREEN_LIMITS.advice, EVERGREEN_LIMITS.phi],
  },
  refused: [{ name: 'eligibility_portal_login', category: 'binding_send', description: 'Fairstay Eligibility Checks never logs in to payer or state portals; staff run the checks.' }],
  prompt: { title: 'Check resident eligibility', description: 'Walks the host model through the weekly eligibility review with Fairstay Eligibility Checks.', text: 'You are helping a nursing-home business office with fairstay-eligibility-checks.\n\nRules: Fairstay Eligibility Checks reads files only and never logs in to portals. Resident names and ids are pseudonyms in results.\n\n1. Call eligibility_check with the census, the eligibility results and as_of.\n2. Lead with coverage_ended, inactive and benefit_exhausted: these days may not be paid.\n3. Then qualifying stay problems for Part A residents.\n4. Then stale checks and renewals.\n5. Call eligibility_write_report for the office.' },
});
