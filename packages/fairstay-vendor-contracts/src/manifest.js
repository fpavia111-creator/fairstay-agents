import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, AMOUNT, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { checkVendorContracts } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const VENDOR = { aliases: ['Vendor', 'Vendor Name', 'Supplier', 'Payee'], required: true };
const CODE = { aliases: ['Code', 'Item', 'Item Code', 'SKU', 'Service Code'] };
export const CONTRACT_FIELDS = Object.freeze({ vendor: VENDOR, contract_no: { aliases: ['Contract', 'Contract #', 'Contract Number', 'Agreement'] }, start: { aliases: ['Start', 'Start Date', 'Effective Date'], type: 'date' }, end: { aliases: ['End', 'End Date', 'Expiration', 'Expires', 'Term End'], type: 'date' }, auto_renew: { aliases: ['Auto Renew', 'Fairstay', 'Renews', 'Automatic Renewal'] }, notice_days: { aliases: ['Notice Days', 'Notice Period', 'Termination Notice'], type: 'number' }, escalator_pct: { aliases: ['Escalator', 'Escalator %', 'Annual Increase', 'Price Increase Cap'], type: 'number' }, contact_email: { aliases: ['Contact Email', 'Email', 'Vendor Email'], phi: 'email' }, contact_phone: { aliases: ['Contact Phone', 'Phone', 'Vendor Phone'], phi: 'phone' } });
export const SPEND_FIELDS = Object.freeze({ vendor: VENDOR, date: { aliases: ['Date', 'Invoice Date', 'Posted'], type: 'date', required: true }, amount: { ...AMOUNT, required: true }, code: CODE, qty: { aliases: ['Qty', 'Quantity', 'Units'], type: 'number' }, unit_price: { aliases: ['Unit Price', 'Price', 'Rate', 'Each'], type: 'money' } });
export const PRICE_FIELDS = Object.freeze({ vendor: VENDOR, code: { ...CODE, required: true }, rate: { aliases: ['Rate', 'Contract Rate', 'Contract Price', 'Price'], type: 'money', required: true } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: { warn_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Flag notice deadlines within this many days (default 60)' }, no_contract_over: { type: 'number', minimum: 0, description: 'Flag spend with no contract at or above this amount (default 10000)' } } };
export const MEMORY_KINDS = Object.freeze({ contract_note: { description: 'A note on a vendor contract, e.g. {"vendor": "Lone Star Linen", "note": "notice must be certified mail"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['vendor', 'note'], properties: { vendor: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  contracts: fileArg('Vendor contract list under --root: vendor, contract number, start, end, auto renew, notice days, escalator percent, contact'),
  spend: fileArg('Vendor spend lines under --root: vendor, date, amount, item code, quantity, unit price'),
  prices: fileArg('Optional contract price list under --root: vendor, item code, rate'),
  rules: fileArg('Optional rules JSON: warn_days, no_contract_over'),
  as_of: DATE_ARG('Review date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'vendors_rules') : {}; return checkVendorContracts(ctx.records(a.contracts, 'contracts'), ctx.records(a.spend, 'spend'), a.prices ? ctx.records(a.prices, 'prices') : [], { asOf: a.as_of || today(), warnDays: r.warn_days, noContractOver: r.no_contract_over }); };
const summary = (o) => `${o.contracts} contract(s); ${o.spend} spent with ${o.vendors_with_spend} vendor(s). ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing to act on'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'vendors', title: 'Fairstay Vendor Contracts',
  description: 'Vendor contract analysis for nursing homes: auto-renewal notice dates coming up or passed, expired contracts still billing, spend with no contract, price increases above the contract escalator and charges above contracted rates. Vendor contact details are masked before results reach the model.',
  args, required: ['contracts', 'spend'],
  sources: { contracts: { label: 'Vendor contracts', args: ['contracts'], fields: CONTRACT_FIELDS }, spend: { label: 'Vendor spend', args: ['spend'], fields: SPEND_FIELDS }, prices: { label: 'Contract prices', args: ['prices'], fields: PRICE_FIELDS } },
  configSchemas: { vendors_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Review vendor contracts', description: 'Check vendor contracts against dates and spend.' },
  report: {
    title: { en: 'Vendor contract review', es: 'Revisión de contratos con proveedores', de: 'Lieferantenvertragsprüfung', fr: 'Revue des contrats fournisseurs', pt: 'Revisão de contratos de fornecedores', it: 'Revisione dei contratti fornitori', ja: '取引先契約レビュー', zh: '供应商合同审查', ko: '공급업체 계약 검토' },
    base: 'vendors-vendor-contracts',
    rows: (o) => o.items.map((i) => ({ status: i.status, vendor: i.vendor, contract_no: i.contract_no || '', code: i.code || '', end: i.end || '', notice_by: i.notice_by || '', amount: i.amount, contact_email: i.contact_email || '', contact_phone: i.contact_phone || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'vendor', 'contract_no', 'end', 'notice_by', 'amount', 'message'],
    limits: [EVERGREEN_LIMITS.files, 'Read each contract for its own notice, renewal and price terms; the dates here come from your list.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'contract_notice_send', category: 'binding_send', description: 'Fairstay Vendor Contracts never sends termination or renewal notices.' }],
  prompt: { title: 'Vendor contract review', description: 'Walks the host model through a vendor contract review with Fairstay Vendor Contracts.', text: 'You are helping a nursing-home administrator with fairstay-vendor-contracts.\n\nRules: Fairstay Vendor Contracts reads files only. Vendor contacts are masked.\n\n1. Call vendors_check.\n2. Lead with notice windows open and expired contracts.\n3. Call vendors_write_report.' },
});
