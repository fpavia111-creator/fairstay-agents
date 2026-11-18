// Fairstay Bank Reconciliation logic: daily bank reconciliation. No I/O.
import { str, num, isoDate, daysBetween, idKey, sortByStatus, countBy, total, round2 } from 'fairstay-core';

const ORDER = { unexplained_difference: 0, amount_differs: 1, bank_not_in_books: 2, stale_check: 3, deposit_in_transit_long: 4 };
const acctKey = (v) => str(v).replace(/[^0-9A-Za-z]/g, '').toUpperCase();

/**
 * bank: [{ account, date, amount (+ in, - out), check_no, description }]
 * books: [{ account, date, amount, check_no, description }]
 * opts: { asOf, matchDays=3, staleDays=90, transitDays=3, balances: { account: { bank, book } } }
 */
export function reconcile(bank, books, { asOf, matchDays = 3, staleDays = 90, transitDays = 3, balances = {} } = {}) {
  const B = bank.map((r, i) => ({ account: str(r.account), date: isoDate(r.date), amount: round2(num(r.amount) || 0), check_no: idKey(r.check_no), description: str(r.description), line: i + 1, used: false }));
  const K = books.map((r, i) => ({ account: str(r.account), date: isoDate(r.date), amount: round2(num(r.amount) || 0), check_no: idKey(r.check_no), description: str(r.description), line: i + 1, used: false }));
  const items = [];
  // Bank lines indexed by check number and by amount, per account, in statement order (scanning the whole
  // statement for every book entry took 10 s at 10,000 rows).
  const index = (f) => { const m = new Map(); for (const x of B) { const k = f(x); if (k === null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
  const byCheck = index((x) => (x.check_no ? `${x.check_no}|${acctKey(x.account)}` : null));
  const cents = (a) => Math.round(a * 100); const byAmount = index((x) => `${acctKey(x.account)}|${cents(x.amount)}`);
  // 1. Checks by number.
  for (const k of K) {
    if (!k.check_no) continue;
    const b = (byCheck.get(`${k.check_no}|${acctKey(k.account)}`) || []).find((x) => !x.used); if (!b) continue;
    b.used = k.used = true;
    if (Math.abs(b.amount - k.amount) > 0.005) items.push({ status: 'amount_differs', account: k.account, date: b.date, check_no: k.check_no, amount: round2(Math.abs(b.amount - k.amount)), bank_amount: b.amount, book_amount: k.amount, message: `Check ${k.check_no} cleared for ${b.amount}; the books have ${k.amount}.`, fix: 'Find which is right (the check image) and correct the books or ask the bank to fix the encoding error.' });
  }
  // 2. Everything else by account, amount and date within matchDays (closest date first).
  for (const k of K.filter((x) => !x.used)) {
    const cands = (byAmount.get(`${acctKey(k.account)}|${cents(k.amount)}`) || []).filter((x) => !x.used && Math.abs(x.amount - k.amount) < 0.005 && x.date && k.date && Math.abs(daysBetween(k.date, x.date)) <= matchDays && (!x.check_no || !k.check_no));
    cands.sort((a, b) => Math.abs(daysBetween(k.date, a.date)) - Math.abs(daysBetween(k.date, b.date)));
    if (cands[0]) { cands[0].used = k.used = true; }
  }
  for (const b of B.filter((x) => !x.used)) items.push({ status: 'bank_not_in_books', account: b.account, date: b.date, check_no: b.check_no || null, amount: b.amount, description: b.description, message: `${b.amount > 0 ? 'Deposit' : 'Withdrawal'} of ${Math.abs(b.amount)} on ${b.date} (${b.description || 'no description'}) is not in the books.`, fix: b.amount > 0 ? 'Post the receipt to the right payer and resident account.' : 'Record the fee or debit, or dispute it with the bank if it is not yours.' });
  const outstanding = [];
  for (const k of K.filter((x) => !x.used)) {
    const age = k.date && asOf ? daysBetween(k.date, asOf) : null; outstanding.push(k);
    if (k.amount < 0 && age !== null && age > staleDays) items.push({ status: 'stale_check', account: k.account, date: k.date, check_no: k.check_no || null, amount: k.amount, age_days: age, description: k.description, message: `${k.check_no ? `Check ${k.check_no}` : 'Payment'} for ${-k.amount} written ${k.date} (${age} days) has not cleared.`, fix: 'Contact the payee; void and reissue, or follow your state\'s unclaimed property rules for old checks (resident refunds included).' });
    else if (k.amount > 0 && age !== null && age > transitDays) items.push({ status: 'deposit_in_transit_long', account: k.account, date: k.date, amount: k.amount, age_days: age, description: k.description, message: `Deposit of ${k.amount} recorded ${k.date} (${age} days) is not on the bank statement.`, fix: 'Find the deposit slip or remote deposit receipt; the deposit may be lost or posted to another account.' });
  }
  // Reconciliation per account when balances are given: bank + deposits in transit - outstanding checks + bank items not booked... should equal books.
  const recon = [];
  for (const [account, bal] of Object.entries(balances)) {
    const bankBal = num(bal.bank); const bookBal = num(bal.book); if (bankBal === null || bookBal === null) continue;
    const a = acctKey(account);
    const os = round2(outstanding.filter((k) => acctKey(k.account) === a).reduce((s, k) => s + k.amount, 0));
    const notBooked = round2(items.filter((i) => i.status === 'bank_not_in_books' && acctKey(i.account) === a).reduce((s, i) => s + i.amount, 0));
    const diffs = round2(items.filter((i) => i.status === 'amount_differs' && acctKey(i.account) === a).reduce((s, i) => s + (i.bank_amount - i.book_amount), 0));
    const adjustedBank = round2(bankBal + os); const adjustedBook = round2(bookBal + notBooked + diffs);
    const unexplained = round2(adjustedBank - adjustedBook);
    recon.push({ account, bank_balance: bankBal, outstanding_net: os, adjusted_bank: adjustedBank, book_balance: bookBal, bank_items_not_booked: notBooked, check_amount_differences: diffs, adjusted_book: adjustedBook, unexplained });
    if (Math.abs(unexplained) > 0.005) items.push({ status: 'unexplained_difference', account, date: asOf, amount: Math.abs(unexplained), message: `After every listed item, ${unexplained > 0 ? 'the bank is higher' : 'the books are higher'} by ${Math.abs(unexplained)}.`, fix: 'Look for a transposed amount, an entry posted to the wrong account, or a missing statement page.' });
  }
  sortByStatus(items, ORDER);
  return { as_of: asOf, bank_lines: B.length, book_entries: K.length, matched: B.filter((x) => x.used).length, reconciliation: recon, by_status: countBy(items, 'status'), items };
}
