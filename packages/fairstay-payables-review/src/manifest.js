import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, AMOUNT, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { checkPayables } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const VENDOR = { aliases: ['Vendor', 'Vendor Name', 'Supplier', 'Payee', 'Remit To'], required: true };
const BANK = { aliases: ['Bank Account', 'Account Number', 'Remit Account', 'ACH Account', 'Bank Acct'], phi: 'account' };
const PO = { aliases: ['PO', 'PO #', 'PO Number', 'Purchase Order'] };
export const INVOICE_FIELDS = Object.freeze({ vendor: VENDOR, invoice_no: { aliases: ['Invoice', 'Invoice #', 'Invoice Number', 'Inv No'] }, invoice_date: { aliases: ['Invoice Date', 'Inv Date', 'Date'], type: 'date' }, due_date: { aliases: ['Due Date', 'Due', 'Pay By'], type: 'date' }, amount: { ...AMOUNT, required: true }, po_number: PO, paid_on: { aliases: ['Paid On', 'Paid Date', 'Check Date', 'Payment Date'], type: 'date' }, bank_account: BANK });
export const VENDOR_FIELDS = Object.freeze({ vendor: VENDOR, approved: { aliases: ['Approved', 'Active', 'Status', 'Approved Vendor'] }, bank_account: BANK, no_po: { aliases: ['No PO', 'PO Exempt', 'Recurring', 'Utility'] } });
export const PO_FIELDS = Object.freeze({ po_number: { ...PO, required: true }, vendor: { ...VENDOR, required: false }, amount: { ...AMOUNT, aliases: ['Amount', 'PO Amount', 'Total', 'Approved Amount'] }, received_amount: { aliases: ['Received', 'Received Amount', 'Received Value'], type: 'money' }, received_on: { aliases: ['Received On', 'Receipt Date', 'Received Date'], type: 'date' } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  po_required_over: { type: 'number', minimum: 0, description: 'Invoices at or above this amount need a PO unless the vendor is PO exempt (default 1000)' },
  po_tolerance_pct: { type: 'number', minimum: 0, maximum: 100, description: 'Allowed overage on a PO, percent (default 5)' },
} };
export const MEMORY_KINDS = Object.freeze({ vendor_note: { description: 'A note about a vendor, e.g. {"vendor": "Lone Star Linen", "note": "bills monthly on the 25th"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['vendor', 'note'], properties: { vendor: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  invoices: fileArg('AP invoice register under --root: vendor, invoice number, dates, amount, PO, paid date, remit bank account'),
  vendors: fileArg('Vendor master under --root: vendor, approved, bank account on file, PO exempt'),
  pos: fileArg('Optional purchase orders under --root: PO number, vendor, amount, received amount and date'),
  rules: fileArg('Optional rules JSON: po_required_over, po_tolerance_pct'),
  as_of: DATE_ARG('Review date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'payables_rules') : {}; return checkPayables(ctx.records(a.invoices, 'invoices'), ctx.records(a.vendors, 'vendors'), a.pos ? ctx.records(a.pos, 'pos') : [], { asOf: a.as_of || today(), poRequiredOver: r.po_required_over, poTolerancePct: r.po_tolerance_pct }); };
const summary = (o) => `${o.invoices} invoice(s) totalling ${o.invoice_total}. Hold ${o.on_hold}; past due ${o.past_due}; accrue ${o.accrual} for goods received not invoiced. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing to fix'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'payables', title: 'Fairstay Payables Review',
  description: 'Accounts payable review for nursing homes: vendor bank account changes, duplicate invoices, vendors not on the approved list, invoices over the purchase order, missing purchase orders, past-due bills and goods received but not invoiced for the month-end accrual. Bank account numbers are masked before results reach the model.',
  args, required: ['invoices', 'vendors'],
  sources: { invoices: { label: 'AP invoices', args: ['invoices'], fields: INVOICE_FIELDS }, vendors: { label: 'Vendor master', args: ['vendors'], fields: VENDOR_FIELDS }, pos: { label: 'Purchase orders', args: ['pos'], fields: PO_FIELDS } },
  configSchemas: { payables_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Review payables', description: 'Review the AP register before the check run: holds first, then past due and accruals.' },
  report: {
    title: { en: 'Payables review before the check run', es: 'Revisión de cuentas por pagar', de: 'Kreditorenprüfung vor dem Zahllauf', fr: 'Revue des fournisseurs avant paiement', pt: 'Revisão de contas a pagar', it: 'Revisione dei debiti prima dei pagamenti', ja: '支払前の買掛金レビュー', zh: '付款前应付账款审核', ko: '지급 전 매입채무 검토' },
    base: 'payables',
    rows: (o) => o.items.map((i) => ({ status: i.status, vendor: i.vendor, invoice_no: i.invoice_no || '', po_number: i.po_number || '', invoice_date: i.invoice_date || '', due_date: i.due_date || '', amount: i.amount, bank_account: i.bank_account || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'vendor', 'invoice_no', 'po_number', 'due_date', 'amount', 'message', 'fix'],
    limits: [EVERGREEN_LIMITS.files, EVERGREEN_LIMITS.advice, 'It does not check vendors against the OIG exclusion list or SAM; do that at vendor setup.'],
  },
  refused: [{ name: 'payment_release', category: 'money_movement', description: 'Fairstay Payables Review never releases payments or changes vendor bank details.' }],
  prompt: { title: 'Check run review', description: 'Walks the host model through the AP review with Fairstay Payables Review.', text: 'You are helping a nursing-home accounts payable clerk with fairstay-payables-review.\n\nRules: Fairstay Payables Review reads files only. Bank account numbers are masked.\n\n1. Call payables_check before the check run.\n2. Lead with bank_account_changed and duplicate_invoice: hold those.\n3. Give the accrual total for month end.\n4. Call payables_write_report.' },
});
