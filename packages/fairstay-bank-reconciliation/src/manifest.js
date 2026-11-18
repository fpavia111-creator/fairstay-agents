import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, AMOUNT, EVERGREEN_LIMITS, today } from 'fairstay-core';
import { reconcile } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ACCOUNT = { aliases: ['Account', 'Account Number', 'Bank Account', 'Acct', 'Account No'], phi: 'account', required: true };
const LINE = (descPhi) => ({ account: ACCOUNT, date: { aliases: ['Date', 'Posted', 'Post Date', 'Posting Date', 'Transaction Date', 'Entry Date'], type: 'date', required: true }, amount: { ...AMOUNT, required: true }, check_no: { aliases: ['Check', 'Check #', 'Check Number', 'Check No', 'Serial', 'Reference'] }, description: { aliases: ['Description', 'Memo', 'Details', 'Payee', 'Narrative'], ...(descPhi ? { phi: 'free_text' } : {}) } });
export const BANK_FIELDS = Object.freeze(LINE(false));
export const BOOK_FIELDS = Object.freeze(LINE(true));
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  match_days: { type: 'integer', minimum: 0, maximum: 15, description: 'Match amounts within this many days (default 3)' },
  stale_days: { type: 'integer', minimum: 30, maximum: 365, description: 'Checks older than this are stale (default 90)' },
  transit_days: { type: 'integer', minimum: 1, maximum: 30, description: 'Deposits not on the bank after this many days are flagged (default 3)' },
  balances: { type: 'object', description: 'Ending balances by account number: {"1234": {"bank": 100, "book": 90}}', additionalProperties: { type: 'object', additionalProperties: false, required: ['bank', 'book'], properties: { bank: { type: 'number', description: 'Bank statement balance' }, book: { type: 'number', description: 'General ledger balance' } } } },
} };
export const MEMORY_KINDS = Object.freeze({ recurring_item: { description: 'A recurring bank item, e.g. {"description": "MERCHANT FEE", "note": "card processing fee, book to 6420"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['description', 'note'], properties: { description: { type: 'string', minLength: 1, maxLength: 120 }, note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  bank: fileArg('Bank transactions under --root (BAI or CSV export): account, date, amount, check number, description'),
  books: fileArg('Cash entries from the general ledger under --root: account, date, amount, check number, description'),
  rules: fileArg('Optional rules JSON: match_days, stale_days, transit_days, ending balances by account'),
  as_of: DATE_ARG('Reconciliation date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'bankrec_rules') : {}; return reconcile(ctx.records(a.bank, 'bank'), ctx.records(a.books, 'books'), { asOf: a.as_of || today(), matchDays: r.match_days, staleDays: r.stale_days, transitDays: r.transit_days, balances: r.balances }); };
const summary = (o) => `${o.bank_lines} bank line(s), ${o.book_entries} book entr(ies), ${o.matched} matched. ${o.reconciliation.map((r) => `Unexplained ${r.unexplained} on one account`).join('; ')}${o.reconciliation.length ? '. ' : ''}${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Everything matched'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'bankrec', title: 'Fairstay Bank Reconciliation',
  description: 'Daily bank reconciliation for nursing homes: bank lines with no book entry, checks that cleared for a different amount, stale outstanding checks, deposits in transit too long and the unexplained difference per account. Bank account numbers and book memos (which can name residents) are masked before results reach the model.',
  args, required: ['bank', 'books'],
  sources: { bank: { label: 'Bank transactions', args: ['bank'], fields: BANK_FIELDS }, books: { label: 'Book cash entries', args: ['books'], fields: BOOK_FIELDS } },
  configSchemas: { bankrec_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Reconcile the bank', description: 'Match bank lines to book entries and list what is left, with the unexplained difference.' },
  report: {
    title: { en: 'Bank reconciliation', es: 'Conciliación bancaria', de: 'Bankabstimmung', fr: 'Rapprochement bancaire', pt: 'Conciliação bancária', it: 'Riconciliazione bancaria', ja: '銀行勘定照合', zh: '银行对账', ko: '은행 조정' },
    base: 'bankrec-bank-rec',
    rows: (o) => o.items.map((i) => ({ status: i.status, account: i.account, date: i.date, check_no: i.check_no || '', amount: i.amount, description: i.description || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'date', 'check_no', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Reconciliation by account' }, rows: o.reconciliation, columns: ['account', 'bank_balance', 'outstanding_net', 'adjusted_bank', 'book_balance', 'bank_items_not_booked', 'check_amount_differences', 'adjusted_book', 'unexplained'] }],
  },
  refused: [{ name: 'bank_transfer', category: 'money_movement', description: 'Fairstay Bank Reconciliation never moves money or logs in to a bank.' }],
  prompt: { title: 'Daily cash', description: 'Walks the host model through the daily bank reconciliation with Fairstay Bank Reconciliation.', text: 'You are helping a nursing-home accountant with fairstay-bank-reconciliation.\n\nRules: Fairstay Bank Reconciliation reads files only. Account numbers are masked.\n\n1. Call bankrec_check with the bank file, the book entries and the balances.\n2. Lead with the unexplained difference.\n3. Then deposits not booked (post them to residents), then stale checks.\n4. Call bankrec_write_report.' },
});
