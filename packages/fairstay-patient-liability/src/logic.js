// Fairstay Patient Liability logic: patient liability (Medicaid share of cost) and private-pay balances. No I/O.
import { str, num, isoDate, round2, censusDays, monthBounds, monthOf, daysBetween, sortByStatus, countBy, total, idKey, addDays } from 'fairstay-core';

const ORDER = { not_billed: 0, underbilled: 1, overbilled: 2, credit_balance: 3, unpaid: 4 };

/** Liability amount in force for a month (the newest notice effective on or before the month start, not ended before it). */
export function liabilityFor(schedule, residentKey, month) {
  const b = monthBounds(month);
  const rows = schedule.filter((s) => idKey(s.resident_id || s.resident_name) === residentKey && isoDate(s.effective_from) && isoDate(s.effective_from) <= b.end && (!isoDate(s.effective_to) || isoDate(s.effective_to) >= b.start));
  rows.sort((x, y) => isoDate(y.effective_from).localeCompare(isoDate(x.effective_from)));
  return rows[0] || null;
}

/**
 * schedule: liability notices; billing: [{resident_id, month, amount, kind}] (kind liability|private);
 * payments: [{resident_id, date, amount}]; census rows (optional, for proration).
 * opts: { month, asOf, prorate=true, unpaidDays=60, tolerance=1 }
 */
export function checkLiability(schedule, billing, payments = [], census = null, { month, asOf, prorate = true, unpaidDays = 60, tolerance = 1 } = {}) {
  const b = monthBounds(month); if (!b) throw new Error('month must be YYYY-MM');
  const items = []; const names = new Map();
  for (const r of [...schedule, ...billing, ...payments]) if (str(r.resident_name)) names.set(idKey(r.resident_id || r.resident_name), str(r.resident_name));
  const cdays = census ? censusDays(census, b.start, b.end) : null;
  const inHouse = (k) => (cdays ? new Set(cdays.filter((d) => idKey(d.resident_id) === k).map((d) => d.date)).size : b.days);
  const billedMonth = (k, kind) => billing.filter((x) => idKey(x.resident_id || x.resident_name) === k && (str(x.month).slice(0, 7) || monthOf(x.date)) === month && (!kind || str(x.kind || 'liability').toLowerCase().startsWith(kind))).reduce((s, x) => s + (num(x.amount) || 0), 0);
  const residents = new Set(schedule.map((s) => idKey(s.resident_id || s.resident_name)));
  for (const k of residents) {
    const notice = liabilityFor(schedule, k, month); if (!notice) continue;
    const monthly = num(notice.monthly_amount) || 0; const days = inHouse(k);
    if (!days) continue;
    const expected = round2(prorate && days < b.days ? (monthly * days) / b.days : monthly);
    const billed = round2(billedMonth(k, 'liab'));
    const base = { resident_id: k, resident_name: names.get(k) || null, month, expected, billed, days_in_house: days, notice_from: isoDate(notice.effective_from) };
    if (expected > 0 && billed === 0) items.push({ status: 'not_billed', ...base, amount: expected, message: `Liability of ${expected} for ${month} was not billed${days < b.days ? ` (${days} of ${b.days} days in the building)` : ''}.`, fix: 'Bill the resident or representative; the Medicaid claim should already be reduced by this amount.' });
    else if (billed + tolerance < expected) items.push({ status: 'underbilled', ...base, amount: round2(expected - billed), message: `Billed ${billed}; the notice from ${base.notice_from} sets ${monthly} a month (${expected} for ${month}).`, fix: 'Bill the difference and make sure the new notice amount is set up in the billing system.' });
    else if (billed > expected + tolerance) items.push({ status: 'overbilled', ...base, amount: round2(billed - expected), message: `Billed ${billed}; the liability for ${month} is ${expected}.`, fix: 'Correct the resident statement; an overbilled liability usually means the Medicaid claim was cut too much as well.' });
  }
  // Balances: everything billed up to the month end minus everything paid up to asOf.
  const all = new Set([...billing, ...payments].map((x) => idKey(x.resident_id || x.resident_name)));
  for (const k of all) {
    const bills = billing.filter((x) => idKey(x.resident_id || x.resident_name) === k && (str(x.month).slice(0, 7) || monthOf(x.date)) <= month);
    const paid = payments.filter((x) => idKey(x.resident_id || x.resident_name) === k && (!asOf || (isoDate(x.date) || '') <= asOf)).reduce((s, x) => s + (num(x.amount) || 0), 0);
    const balance = round2(bills.reduce((s, x) => s + (num(x.amount) || 0), 0) - paid);
    if (balance < -tolerance) items.push({ status: 'credit_balance', resident_id: k, resident_name: names.get(k) || null, month, amount: round2(-balance), balance, message: `Credit balance of ${round2(-balance)} (paid more than billed).`, fix: 'Refund it or apply it, following your state\'s rules on resident fund refunds and timing.' });
    else if (balance > tolerance) {
      // Oldest unpaid month: apply payments to the oldest bills first.
      let left = paid; let oldest = null;
      for (const x of bills.slice().sort((p, q) => String(p.month).localeCompare(String(q.month)))) { const amt = num(x.amount) || 0; if (left >= amt) { left -= amt; continue; } oldest = str(x.month).slice(0, 7); break; }
      const age = oldest ? daysBetween(`${oldest}-01`, asOf || addDays(monthBounds(month).end, 1)) : 0;
      if (age > unpaidDays) items.push({ status: 'unpaid', resident_id: k, resident_name: names.get(k) || null, month, amount: balance, balance, oldest_unpaid_month: oldest, days_unpaid: age, message: `${balance} unpaid; the oldest unpaid bill is ${oldest} (${age} days).`, fix: 'Call the representative, set up a payment plan, and check whether the resident\'s income is reaching the home.' });
    }
  }
  sortByStatus(items, ORDER);
  return { month, residents_with_liability: residents.size, amount_to_bill: total(items.filter((i) => ['not_billed', 'underbilled'].includes(i.status)), 'amount'), unpaid_total: total(items.filter((i) => i.status === 'unpaid'), 'amount'), credits_total: total(items.filter((i) => i.status === 'credit_balance'), 'amount'), by_status: countBy(items, 'status'), items };
}
