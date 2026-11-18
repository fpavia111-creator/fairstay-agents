import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, RESIDENT_ID, RESIDENT_NAME, PAYER, LEVEL, EVERGREEN_LIMITS } from 'evergreen-core';
import { checkManagedCare } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const date = (aliases, req = false) => ({ aliases, type: 'date', ...(req ? { required: true } : {}) });
const AUTH_NO = { aliases: ['Auth Number', 'Authorization Number', 'Auth #', 'Prior Auth', 'Reference Number', 'Auth'], translate: false };
export const CLAIM_FIELDS_MC = Object.freeze({ claim_id: { aliases: ['Claim', 'Claim ID', 'Claim #', 'Invoice #'], required: true, translate: false }, resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: { ...PAYER, required: true }, level: LEVEL,
  from: date(['From', 'Service From', 'Statement From'], true), through: date(['Through', 'Thru', 'Service To', 'Statement Thru']),
  days: { aliases: ['Days', 'Units', 'Covered Days'], type: 'number' }, billed: { aliases: ['Billed', 'Charges', 'Billed Amount', 'Total Charges'], type: 'money' }, paid: { aliases: ['Paid', 'Paid Amount', 'Payment', 'Allowed Paid'], type: 'money' }, auth_number: AUTH_NO });
export const RATE_FIELDS = Object.freeze({ payer: { ...PAYER, required: true }, level: { ...LEVEL, required: true }, rate: { aliases: ['Rate', 'Per Diem', 'Daily Rate', 'Contract Rate'], type: 'money', required: true }, from: date(['From', 'Effective', 'Effective Date', 'Start']), to: date(['To', 'End', 'End Date', 'Term Date']) });
export const AUTH_FIELDS_MC = Object.freeze({ auth_number: { ...AUTH_NO, required: true }, resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, payer: PAYER, level: LEVEL, from: date(['From', 'Start Date', 'Auth From', 'Effective Date']), to: date(['To', 'End Date', 'Auth To', 'Expiration Date']) });
export const MEMORY_KINDS = Object.freeze({ level_alias: { description: 'Two codes for the same level, e.g. {"payer": "Gulf Coast Advantage HMO (fictional)", "code": "SKL2", "level": "L2"}.', effect: 'reads the code as that level for that payer. It changes how levels are read, never a rate.', schema: { type: 'object', additionalProperties: false, required: ['payer', 'code', 'level'], properties: { payer: { type: 'string', minLength: 1, maxLength: 120 }, code: { type: 'string', minLength: 1, maxLength: 20 }, level: { type: 'string', minLength: 1, maxLength: 20 } } } } });
const args = {
  claims: fileArg('Managed care claims under --root: claim, resident, payer, level, from, through, days, billed, paid, authorization number'),
  rates: fileArg('Contract rates under --root (CSV or Excel): payer, level, per-diem rate, effective from and to'),
  auths: fileArg('Authorization log under --root: authorization number, resident, payer, level, from, to'),
};
const run = (a, ctx) => {
  const alias = ctx.memoryFacts('level_alias').map((f) => f.value);
  const fix = (r) => { const m = alias.find((x) => String(x.payer).toLowerCase() === String(r.payer).toLowerCase() && String(x.code).toUpperCase() === String(r.level).toUpperCase()); return m ? { ...r, level: m.level } : r; };
  return checkManagedCare(ctx.records(a.claims, 'claims').map(fix), ctx.records(a.rates, 'rates'), ctx.records(a.auths, 'auths').map(fix));
};
const summary = (o) => `${o.claims} managed care claim(s), ${o.claims_with_findings} with findings. Underpaid ${o.underpaid}; billed below contract ${o.billed_short}; at risk without a matching authorization ${o.at_risk_without_auth}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'No findings'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'willow', title: 'Willow of Managed Care',
  description: 'Checks nursing-home managed care claims (HMO, Medicare Advantage, Medicaid MCO) against contract per-diem rates and authorizations: no contract rate, billed below contract, paid below contract, missing or unknown authorization numbers, levels not authorized and days outside the authorization. Resident identifiers are masked before results reach the model.',
  args, required: ['claims', 'rates', 'auths'],
  sources: { claims: { label: 'Managed care claims', args: ['claims'], fields: CLAIM_FIELDS_MC }, rates: { label: 'Contract rates', args: ['rates'], fields: RATE_FIELDS }, auths: { label: 'Authorization log', args: ['auths'], fields: AUTH_FIELDS_MC } },
  memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check managed care claims', description: 'List managed care claim problems: authorization first, then rates.' },
  report: {
    title: { en: 'Managed care claim check', es: 'Revisión de reclamaciones de atención administrada', de: 'Prüfung Managed-Care-Abrechnungen', fr: 'Contrôle des demandes de soins gérés', pt: 'Verificação de contas de planos de saúde', it: 'Controllo richieste managed care', ja: 'マネージドケア請求チェック', zh: '管理式医疗账单检查', ko: '관리형 의료 청구 점검' },
    base: 'willow-managed-care',
    rows: (o) => o.items.map((i) => ({ status: i.status, claim_id: i.claim_id, resident_id: i.resident_id, resident_name: i.resident_name, payer: i.payer, level: i.level, from: i.from, through: i.through, days: i.days, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'claim_id', 'resident_name', 'payer', 'level', 'days', 'amount', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, 'Rates come from the contract file you supply; carve-outs and outlier terms in the contract are not read.', EVERGREEN_LIMITS.advice, EVERGREEN_LIMITS.phi],
  },
  refused: [{ name: 'claim_submit', category: 'binding_send', description: 'Willow never submits claims or appeals.' }, { name: 'payer_portal_login', category: 'binding_send', description: 'Willow never logs in to plan portals.' }],
  prompt: { title: 'Managed care claim check', description: 'Walks the host model through a managed care claim check with Willow.', text: 'You are helping a nursing-home managed care biller with willow-of-managed-care.\n\nRules: Willow reads files only. Resident names and ids are pseudonyms in results.\n\n1. Call willow_check with the claims, the contract rates and the authorization log.\n2. Hold claims with authorization problems; they will be denied.\n3. List underpayments with the contract amount for an appeal.\n4. If a plan uses its own level codes, offer willow_learn (kind level_alias).\n5. Call willow_write_report.' },
});
