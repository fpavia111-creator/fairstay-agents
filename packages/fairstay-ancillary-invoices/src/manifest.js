import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, CENSUS_FIELDS, RESIDENT_ID, RESIDENT_NAME, AMOUNT, PAYER_TYPES, EVERGREEN_LIMITS, findItem, idKey, round2 } from 'fairstay-core';
import { reviewAncillaries } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const VENDOR = { aliases: ['Vendor', 'Provider', 'Supplier', 'Vendor Name'], required: true };
export const LINE_FIELDS = Object.freeze({ vendor: VENDOR, vendor_type: { aliases: ['Vendor Type', 'Service Type', 'Category', 'Type'] }, invoice_no: { aliases: ['Invoice', 'Invoice #', 'Invoice Number', 'Statement'] }, resident_id: RESIDENT_ID, resident_name: RESIDENT_NAME, date: { aliases: ['Date', 'Service Date', 'DOS', 'Dispense Date', 'Fill Date'], type: 'date', required: true }, code: { aliases: ['Code', 'NDC', 'CPT', 'HCPCS', 'Item Code', 'Item'] }, description: { aliases: ['Description', 'Drug', 'Item Description', 'Service'] }, qty: { aliases: ['Qty', 'Quantity', 'Units'], type: 'number' }, amount: { ...AMOUNT, required: true } });
export const RATE_FIELDS = Object.freeze({ vendor: VENDOR, code: { aliases: ['Code', 'NDC', 'CPT', 'HCPCS', 'Item Code'], required: true }, rate: { aliases: ['Rate', 'Contract Rate', 'Price', 'Unit Price'], type: 'money', required: true } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  snf_pays_for: { type: 'array', description: 'Payer types whose ancillaries the facility pays for (default medicare_a and managed_care; check each managed care contract)', items: { type: 'string', enum: PAYER_TYPES } },
  cb_excluded_codes: { type: 'array', description: 'Codes outside Part A consolidated billing, from the current CMS exclusion lists', items: { type: 'string' } },
  facility_name: { type: 'string', description: 'Facility name for credit requests' },
} };
export const MEMORY_KINDS = Object.freeze({ vendor_contact: { description: 'Who handles credits at a vendor, e.g. {"vendor": "Gulf Coast Pharmacy", "note": "credits@ email, monthly cutoff the 20th"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['vendor', 'note'], properties: { vendor: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  invoices: fileArg('Ancillary invoice lines under --root: vendor, vendor type (pharmacy, therapy, lab, radiology, supply), invoice, resident, date, code, description, quantity, amount'),
  census: fileArg('Census under --root covering the invoice dates'),
  rates: fileArg('Optional contract rates under --root: vendor, code, rate'),
  rules: fileArg('Optional rules JSON: snf_pays_for, cb_excluded_codes, facility_name'),
};
const rules = (a, ctx) => (a.rules ? ctx.readJson(a.rules, 'ancillaries_rules') : {});
const run = (a, ctx) => { const r = rules(a, ctx); return reviewAncillaries(ctx.records(a.invoices, 'invoices'), ctx.records(a.census, 'census'), a.rates ? ctx.records(a.rates, 'rates') : [], { snfPays: r.snf_pays_for, cbExcluded: r.cb_excluded_codes || [] }); };
const summary = (o) => `${o.lines} ancillary line(s) from ${o.vendors} vendor(s), billed ${o.billed}; credits to request ${o.credits_due}. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing to dispute'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'ancillaries', title: 'Fairstay Ancillary Invoices',
  description: 'Ancillary invoice review for nursing homes: pharmacy, therapy, lab, radiology and supply charges for residents not in the building, for residents whose own payer should be billed instead, outside Part A consolidated billing, above contract rates or duplicated, with credit request drafts a person approves and sends. Resident identifiers are masked before results reach the model.',
  args, required: ['invoices', 'census'],
  sources: { invoices: { label: 'Ancillary invoices', args: ['invoices'], fields: LINE_FIELDS }, census: { label: 'Census', args: ['census'], fields: CENSUS_FIELDS }, rates: { label: 'Contract rates', args: ['rates'], fields: RATE_FIELDS } },
  configSchemas: { ancillaries_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Review ancillary invoices', description: 'Check each ancillary line against the census, the payer and the contract rate.' },
  report: {
    title: { en: 'Ancillary invoice review', es: 'Revisión de facturas auxiliares', de: 'Prüfung der Zusatzleistungsrechnungen', fr: 'Revue des factures annexes', pt: 'Revisão de faturas auxiliares', it: 'Revisione fatture ancillari', ja: '付随サービス請求書レビュー', zh: '辅助服务发票审核', ko: '부대 서비스 청구서 검토' },
    base: 'ancillaries',
    rows: (o) => o.items.map((i) => ({ status: i.status, vendor: i.vendor, invoice_no: i.invoice_no || '', resident_id: i.resident_id, resident_name: i.resident_name, date: i.date, code: i.code || '', description: i.description || '', billed: i.billed, amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'vendor', 'invoice_no', 'resident_name', 'date', 'description', 'amount', 'message'],
    limits: [EVERGREEN_LIMITS.files, 'Consolidated billing exclusions change every year; list the codes from the current CMS files. Managed care contracts differ on which ancillaries the facility pays.', EVERGREEN_LIMITS.advice],
  },
  drafts: {
    noun: 'credit_request', verb: 'send', category: 'binding_send', actor: 'your business office manager',
    title: 'Draft a vendor credit request',
    description: 'Write a credit request for one vendor invoice listing every disputed line with the reason and amount. Marked DRAFT; nothing is sent.',
    args: { ...args, invoice_no: { type: 'string', description: 'Invoice number from ancillaries_check' } }, required: ['invoices', 'census', 'invoice_no'],
    build: (a, ctx) => {
      const r = rules(a, ctx); const out = run(a, ctx);
      const first = findItem(out.items, 'invoice_no', a.invoice_no, ctx, { kind: 'claim', label: 'invoice with a disputed line' });
      const lines = out.items.filter((i) => idKey(i.invoice_no) === idKey(first.invoice_no));
      const amt = round2(lines.reduce((s, i) => s + i.amount, 0));
      const rows = lines.map((i) => `| ${i.date} | ${i.resident_name || i.resident_id} | ${i.description || i.code || ''} | ${i.amount} | ${i.message} |`).join('\n');
      return { id: String(first.invoice_no), to: first.vendor, amount: amt, text: `**To:** ${first.vendor} billing [CHECK: credit contact]\n**From:** ${r.facility_name || '[MISSING: facility name]'}\n**Re:** Credit request for invoice ${first.invoice_no}\n\nWe reviewed invoice ${first.invoice_no} against our census and contract and ask for a credit of **${amt}** for these lines:\n\n| Date | Resident | Item | Credit | Reason |\n|---|---|---|---|---|\n${rows}\n\nPlease send a credit memo or a corrected invoice. We will hold these lines until then and pay the rest of the invoice.\n\n[ATTACH: census for the dates]\n\nSigned: [MISSING: name and title]\n` };
    },
  },
  refused: [{ name: 'vendor_payment_hold', category: 'money_movement', description: 'Fairstay Ancillary Invoices never holds, releases or changes vendor payments.' }],
  prompt: { title: 'Ancillary invoice review', description: 'Walks the host model through the monthly ancillary review with Fairstay Ancillary Invoices.', text: 'You are helping a nursing-home business office review ancillary invoices with fairstay-ancillary-invoices.\n\nRules: Fairstay Ancillary Invoices reads files and writes drafts only. Resident names and ids are pseudonyms.\n\n1. Call ancillaries_check with the invoice lines, the census and the contract rates.\n2. Group credits by vendor invoice.\n3. Offer ancillaries_draft_credit_request for each invoice with credits.\n4. Call ancillaries_write_report.' },
});
