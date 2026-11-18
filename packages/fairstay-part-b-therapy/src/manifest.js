import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, EVERGREEN_LIMITS } from 'fairstay-core';
import { checkPartB, DEFAULT_TIMED } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const THERAPY_FIELDS = Object.freeze({ resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME,
  date: { aliases: ['Date', 'Date of Service', 'DOS', 'Service Date'], type: 'date', required: true },
  cpt: { aliases: ['CPT', 'Code', 'Procedure', 'HCPCS', 'Procedure Code'], required: true, translate: false },
  modifiers: { aliases: ['Modifiers', 'Modifier', 'Mods', 'Modifier 1'], translate: false },
  minutes: { aliases: ['Minutes', 'Treatment Minutes', 'Timed Minutes', 'Mins'], type: 'number' },
  units: { aliases: ['Units', 'Billed Units', 'Qty'], type: 'number' },
  charge: { aliases: ['Charge', 'Charges', 'Billed', 'Amount'], type: 'money' },
  allowed: { aliases: ['Allowed', 'Allowed Amount', 'Fee Schedule', 'Expected'], type: 'money' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  timed_codes: { type: 'array', maxItems: 500, items: { type: 'string', pattern: '^[A-Za-z0-9]{5}$' }, description: 'Your list of timed (15-minute) codes' },
  kx_threshold_pt_slp: { type: 'number', minimum: 0, description: 'KX threshold for PT and speech together for the year (set it from the current CMS figure)' },
  kx_threshold_ot: { type: 'number', minimum: 0, description: 'KX threshold for OT for the year (set it from the current CMS figure)' },
} };
export const MEMORY_KINDS = Object.freeze({ timed_code: { description: 'A code this home bills as a timed 15-minute code, e.g. {"code": "97129", "note": "cognitive therapy, first 15 minutes"}.', effect: 'adds the code to the 8-minute rule check. It only adds checks.', schema: { type: 'object', additionalProperties: false, required: ['code'], properties: { code: { type: 'string', pattern: '^[A-Za-z0-9]{5}$' }, note: { type: 'string', maxLength: 300 } } } } });
const args = {
  therapy: fileArg('Part B therapy lines under --root: resident, date, CPT, modifiers, timed minutes, units, charge, allowed amount'),
  census: fileArg('Optional census under --root, to find lines billed during a Medicare Part A stay'),
  rules: fileArg('Optional rules JSON: timed codes and the KX thresholds for the year'),
};
const run = (a, ctx) => {
  const r = a.rules ? ctx.readJson(a.rules, 'partb_rules') : {};
  const timed = [...(r.timed_codes || DEFAULT_TIMED), ...ctx.memoryFacts('timed_code').map((f) => f.value.code)];
  const kx = r.kx_threshold_pt_slp || r.kx_threshold_ot ? { pt_slp: r.kx_threshold_pt_slp, ot: r.kx_threshold_ot } : null;
  return checkPartB(ctx.records(a.therapy, 'therapy'), { census: a.census ? ctx.records(a.census, 'census') : null, timed, kxThresholds: kx });
};
const summary = (o) => `${o.lines} Part B therapy line(s) for ${o.residents} resident(s); ${o.charges_at_risk} in charges at risk. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'partb', title: 'Fairstay Part B Therapy',
  description: 'Checks Medicare Part B therapy for nursing-home residents before billing: timed units over the 8-minute rule, missing GP/GO/GN discipline modifiers, lines over the yearly KX threshold without KX, therapy billed to Part B on days the resident was in a Part A stay, and duplicate lines. Resident identifiers are masked before results reach the model.',
  args, required: ['therapy'],
  sources: { therapy: { label: 'Part B therapy lines', args: ['therapy'], fields: THERAPY_FIELDS }, census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS } },
  configSchemas: { partb_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check Part B therapy', description: 'List Part B therapy lines that would be denied or overpaid.' },
  report: {
    title: { en: 'Part B therapy check', es: 'Revisión de terapia de la Parte B', de: 'Prüfung Teil-B-Therapie', fr: 'Contrôle de la thérapie partie B', pt: 'Verificação de terapia da Parte B', it: 'Controllo terapia Parte B', ja: 'パートB療法チェック', zh: 'B部分治疗检查', ko: '파트 B 치료 점검' },
    base: 'partb-part-b',
    rows: (o) => o.items.map((i) => ({ status: i.status, resident_id: i.resident_id, resident_name: i.resident_name, date: i.date, cpt: i.cpt, units: i.units, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'resident_name', 'date', 'cpt', 'units', 'amount', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'The 8-minute rule is applied to total timed minutes per resident per day; untimed codes are not counted. KX thresholds are the figures you set for the year.', EVERGREEN_LIMITS.advice, EVERGREEN_LIMITS.phi],
  },
  refused: [{ name: 'claim_submit', category: 'binding_send', description: 'Fairstay Part B Therapy never submits claims.' }],
  prompt: { title: 'Part B therapy check', description: 'Walks the host model through a Part B therapy check with Fairstay Part B Therapy.', text: 'You are helping a therapy biller at a nursing home with fairstay-part-b-therapy.\n\nRules: Fairstay Part B Therapy reads files only. Resident names and ids are pseudonyms in results.\n\n1. Call partb_check with the therapy lines, the census and the rules.\n2. Take part_a_overlap lines off the Part B claim first.\n3. Then units over the 8-minute rule and duplicates.\n4. Then modifiers (GP/GO/GN and KX).\n5. Call partb_write_report.' },
});
