import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, EVERGREEN_LIMITS, today, idKey, num } from 'evergreen-core';
import { checkPartA } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const d = (aliases) => ({ aliases, type: 'date' });
export const CLAIM_LINE_FIELDS = Object.freeze({
  claim_id: { aliases: ['Claim', 'Claim ID', 'Claim #', 'ICN', 'Patient Control Number', 'PCN'], required: true, translate: false },
  resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  from: d(['Statement From', 'From', 'Service From', 'From Date']),
  through: d(['Statement Through', 'Statement Thru', 'Through', 'Thru', 'Service To', 'Thru Date']),
  revenue_code: { aliases: ['Revenue Code', 'Rev Code', 'Rev', 'RC'], required: true, translate: false },
  hipps: { aliases: ['HIPPS', 'HIPPS Code', 'Rate Code', 'HCPCS/Rates', 'HCPCS'], translate: false },
  units: { aliases: ['Units', 'Days', 'Service Units', 'Covered Days'], type: 'number' },
  charges: { aliases: ['Charges', 'Total Charges', 'Line Charges', 'Amount'], type: 'money' },
  qs_from: d(['Occurrence Span 70 From', 'OS 70 From', 'Qualifying Stay From', 'QS From']),
  qs_to: d(['Occurrence Span 70 Through', 'Occurrence Span 70 Thru', 'OS 70 Thru', 'Qualifying Stay Through', 'QS Thru']),
  coinsurance_days: { aliases: ['Coinsurance Days', 'Coins Days', 'Value Code 09'], type: 'number' },
});
const PRIOR_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, part_a_days_used: { aliases: ['Part A Days Used', 'Prior SNF Days', 'Benefit Days Used'], type: 'number', required: true } });

export const MEMORY_KINDS = Object.freeze({
  claim_note: {
    description: 'A note on how this home builds Part A claims, e.g. {"note": "interim bills go out on the 5th"}.',
    effect: 'is shown with results for the billing team. It never changes a check.',
    schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } },
  },
});
const args = {
  claims: fileArg('Part A claim lines under --root (UB-04 / 837I export): claim, resident, statement from and through, revenue code, HIPPS, units, charges, occurrence span 70 dates, coinsurance days'),
  census: fileArg('Optional census under --root, to check covered days and coinsurance days'),
  prior_days: fileArg('Optional file under --root: Part A days each resident used earlier in the benefit period'),
  as_of: DATE_ARG('Date the claims are checked on (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => {
  const prior = new Map((a.prior_days ? ctx.records(a.prior_days, 'prior_days') : []).map((r) => [idKey(r.resident_id || r.resident_name), num(r.part_a_days_used) || 0]));
  return checkPartA(ctx.records(a.claims, 'claims'), { census: a.census ? ctx.records(a.census, 'census') : null, priorDays: prior, asOf: a.as_of || today() });
};
const summary = (o) => `${o.claims} Part A claim(s), ${o.claims_with_findings} with findings (${o.charges_on_flagged_claims} in charges). ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'pine', title: 'Pine of Part A',
  description: 'Checks Medicare Part A skilled nursing claims before they go out: missing or malformed PDPM HIPPS codes on revenue code 0022, days billed at the default ZZZZZ code, covered days that differ from the census, coinsurance days that differ from benefit days 21-100, missing or short qualifying hospital stays (occurrence span 70), claims crossing a month end and through dates in the future. Resident identifiers are masked before results reach the model.',
  args, required: ['claims'],
  sources: { claims: { label: 'Part A claim lines', args: ['claims'], fields: CLAIM_LINE_FIELDS }, census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, prior_days: { label: 'Earlier Part A days', args: ['prior_days'], fields: PRIOR_FIELDS } },
  memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check Part A claims', description: 'List problems on Part A SNF claims, claim by claim, before they are submitted.' },
  report: {
    title: { en: 'Medicare Part A claim check', es: 'Revisión de reclamaciones de Medicare Parte A', de: 'Prüfung Medicare-Teil-A-Abrechnungen', fr: 'Contrôle des demandes Medicare partie A', pt: 'Verificação de contas do Medicare Parte A', it: 'Controllo richieste Medicare Parte A', ja: 'メディケア パートA 請求チェック', zh: '联邦医保A部分账单检查', ko: '메디케어 파트 A 청구 점검' },
    base: 'pine-part-a',
    rows: (o) => o.items.map((i) => ({ status: i.status, claim_id: i.claim_id, resident_id: i.resident_id, resident_name: i.resident_name, from: i.from, through: i.through, hipps: i.hipps || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'claim_id', 'resident_name', 'from', 'through', 'hipps', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'HIPPS checks look at the PDPM code shape, not at whether the MDS supports the code. Rules are summarised from CMS SNF billing guidance as of 2026; check current guidance.', EVERGREEN_LIMITS.advice, EVERGREEN_LIMITS.phi],
  },
  refused: [{ name: 'claim_submit', category: 'binding_send', description: 'Pine never submits claims; the biller does.' }, { name: 'mds_edit', category: 'production_deploy', description: 'Pine never changes MDS assessments.' }],
  prompt: { title: 'Part A claim scrub', description: 'Walks the host model through a Part A claim check with Pine.', text: 'You are helping a Medicare biller at a nursing home with pine-of-part-a.\n\nRules: Pine reads files only and never submits claims or edits assessments. Resident names and ids are pseudonyms in results.\n\n1. Call pine_check with the claims, the census and as_of.\n2. Hold claims with no_hipps_line, hipps_missing, hipps_invalid, days_mismatch or coinsurance_mismatch.\n3. For default_hipps, say days are paid at the lowest rate and the MDS team should look.\n4. Call pine_write_report for the biller.' },
});
