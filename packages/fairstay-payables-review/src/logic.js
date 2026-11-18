// Fairstay Payables Review logic: accounts payable review. No I/O.
import { str, num, isoDate, daysBetween, payerKey, idKey, yes, sortByStatus, countBy, total, round2 } from 'fairstay-core';

const ORDER = { bank_account_changed: 0, duplicate_invoice: 1, vendor_not_approved: 2, over_po: 3, missing_po: 4, past_due: 5, received_not_invoiced: 6 };
const vkey = (v) => payerKey(v);
const acct = (v) => str(v).replace(/[^0-9A-Za-z]/g, '');

/**
 * invoices: [{ vendor, invoice_no, invoice_date, due_date, amount, po_number, paid_on, bank_account }]
 * vendors: [{ vendor, approved (Y/N), bank_account, no_po (Y: utilities, rent...) }]
 * pos: [{ po_number, vendor, amount, received_amount, received_on }]
 * opts: { asOf, poRequiredOver=1000, poTolerancePct=5 }
 */
export function checkPayables(invoices, vendors, pos = [], { asOf, poRequiredOver = 1000, poTolerancePct = 5 } = {}) {
  const V = new Map(vendors.map((v) => [vkey(v.vendor), v]));
  const P = new Map(pos.map((p) => [idKey(p.po_number), p]));
  const items = []; const seen = new Map(); const byPo = new Map();
  invoices.forEach((r, i) => {
    const amount = num(r.amount) || 0; const vendor = str(r.vendor); const v = V.get(vkey(vendor));
    const base = { vendor, invoice_no: str(r.invoice_no) || null, invoice_date: isoDate(r.invoice_date), due_date: isoDate(r.due_date), po_number: str(r.po_number) || null, amount, bank_account: str(r.bank_account) || null, line: i + 1 };
    const add = (status, message, fix, extra = {}) => items.push({ status, ...base, ...extra, message, fix });
    const k1 = `${vkey(vendor)}|${idKey(r.invoice_no)}`; const k2 = `${vkey(vendor)}|${amount}|${base.invoice_date}`;
    const dup = (r.invoice_no && seen.get(k1)) || seen.get(k2);
    if (dup) add('duplicate_invoice', `Looks like a duplicate of line ${dup.line} (${dup.invoice_no || 'same amount and date'}).`, 'Hold it; pay only one and void the other.', { duplicate_of_line: dup.line });
    if (r.invoice_no) seen.set(k1, base); seen.set(k2, base);
    if (!v || (str(v.approved) && !yes(v.approved))) add('vendor_not_approved', `${vendor} is not on the approved vendor list.`, 'Hold payment until the vendor is set up and approved (W-9, insurance, exclusion check).');
    if (v && v.bank_account && r.bank_account && acct(v.bank_account) !== acct(r.bank_account)) add('bank_account_changed', `The invoice asks for payment to a different bank account than ${vendor}'s vendor file.`, 'Call the vendor at the phone number already on file (not the one on the invoice) before paying; this is how payment fraud usually starts.');
    const po = r.po_number ? P.get(idKey(r.po_number)) : null;
    if (po && !dup) byPo.set(idKey(r.po_number), [...(byPo.get(idKey(r.po_number)) || []), base]);
    else if (!po && amount >= poRequiredOver && !(v && yes(v.no_po))) add('missing_po', r.po_number ? `PO ${r.po_number} is not in the PO file.` : `No purchase order for ${amount}.`, 'Get the PO or a written approval from the budget owner before paying.');
    if (!isoDate(r.paid_on) && base.due_date && asOf && base.due_date < asOf) add('past_due', `Unpaid ${daysBetween(base.due_date, asOf)} days past the due date.`, 'Pay it, or record why it is held; late fees and credit holds follow.', { days_past_due: daysBetween(base.due_date, asOf) });
  });
  for (const [k, invs] of byPo) {
    const po = P.get(k); const cap = num(po.amount) || 0; const billed = round2(invs.reduce((s, x) => s + x.amount, 0));
    if (billed > cap * (1 + poTolerancePct / 100)) { const last = invs.at(-1); items.push({ status: 'over_po', ...last, amount: round2(billed - cap), message: `Invoices on PO ${po.po_number} total ${billed}; the PO is ${cap}.`, fix: 'Get the overage approved, or ask the vendor for a credit.', po_amount: cap, invoiced: billed }); }
  }
  for (const po of pos) {
    const rec = num(po.received_amount) || 0; if (!rec) continue;
    const invd = round2((byPo.get(idKey(po.po_number)) || []).reduce((s, x) => s + x.amount, 0));
    if (rec - invd > 0.005) items.push({ status: 'received_not_invoiced', vendor: str(po.vendor), invoice_no: null, po_number: str(po.po_number), amount: round2(rec - invd), received_on: isoDate(po.received_on), message: `Goods received on PO ${po.po_number} (${rec}) exceed invoices so far (${invd}).`, fix: 'Book the difference as an accrual at month end.' });
  }
  sortByStatus(items, ORDER);
  return { as_of: asOf, invoices: invoices.length, invoice_total: total(invoices, (x) => num(x.amount) || 0), past_due: total(items.filter((i) => i.status === 'past_due'), 'amount'), on_hold: total(items.filter((i) => ['bank_account_changed', 'duplicate_invoice', 'vendor_not_approved'].includes(i.status)), 'amount'), accrual: total(items.filter((i) => i.status === 'received_not_invoiced'), 'amount'), by_status: countBy(items, 'status'), items };
}
