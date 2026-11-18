// Walnut logic: vendor contracts against spend. No I/O.
import { str, num, isoDate, addDays, daysBetween, payerKey, idKey, yes, sortByStatus, countBy, total, round2 } from 'evergreen-core';

const ORDER = { expired_still_billing: 0, notice_window_open: 1, above_contract_rate: 2, price_increase_above_escalator: 3, spend_no_contract: 4, auto_renewed: 5 };

/**
 * contracts: [{ vendor, contract_no, start, end, auto_renew, notice_days, escalator_pct, contact_email, contact_phone }]
 * spend: [{ vendor, date, amount, code, unit_price }]; prices: [{ vendor, code, rate }]
 * opts: { asOf, warnDays=60, noContractOver=10000, tolerance=0.01 }
 */
export function checkVendorContracts(contracts, spend, prices = [], { asOf, warnDays = 60, noContractOver = 10000, tolerance = 0.01 } = {}) {
  // Contracts, spend and prices grouped by vendor once (scanning or copying them per row took seconds at 10,000 rows).
  const groupBy = (rows, f) => { const m = new Map(); for (const r of rows) { const k = f(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const C = groupBy(contracts, (c) => payerKey(c.vendor)); const spendBy = groupBy(spend, (s) => payerKey(s.vendor));
  const priceOf = new Map(); for (const x of prices) { const k = `${payerKey(x.vendor)}|${idKey(x.code)}`; if (!priceOf.has(k)) priceOf.set(k, x); }
  const items = [];
  for (const c of contracts) {
    const end = isoDate(c.end); if (!end) continue;
    const base = { vendor: str(c.vendor), contract_no: str(c.contract_no) || null, end, contact_email: str(c.contact_email) || null, contact_phone: str(c.contact_phone) || null };
    const nd = num(c.notice_days) || 0; const deadline = addDays(end, -nd); const left = daysBetween(asOf, deadline);
    if (yes(c.auto_renew) && end >= asOf) {
      if (left >= 0 && left <= warnDays) items.push({ status: 'notice_window_open', ...base, amount: 0, notice_by: deadline, days_left: left, message: `${base.vendor} renews automatically on ${end} unless you give notice by ${deadline} (${left} days).`, fix: 'Decide now: renegotiate, bid it out, or let it renew. Send notice in the way the contract requires.' });
      else if (left < 0) items.push({ status: 'auto_renewed', ...base, amount: 0, notice_by: deadline, days_left: left, message: `The notice date for ${base.vendor} passed on ${deadline}; it will renew on ${end}.`, fix: 'Put next year\'s notice date in the calendar now.' });
    }
    if (!yes(c.auto_renew) && end < asOf) {
      const after = (spendBy.get(payerKey(c.vendor)) || []).filter((s) => isoDate(s.date) > end);
      const later = (C.get(payerKey(c.vendor)) || []).some((x) => x !== c && isoDate(x.start) && isoDate(x.start) <= asOf && (!isoDate(x.end) || isoDate(x.end) >= asOf));
      if (after.length && !later) items.push({ status: 'expired_still_billing', ...base, amount: total(after, (s) => num(s.amount) || 0), message: `${base.vendor}'s contract ended ${end}, and ${after.length} charge(s) came after it.`, fix: 'Sign a renewal or a new contract; without one, prices and terms are not protected.' });
    }
  }
  const byVendor = spendBy;
  for (const [k, ss] of byVendor) {
    const amt = total(ss, (s) => num(s.amount) || 0);
    if (!C.has(k) && amt >= noContractOver) items.push({ status: 'spend_no_contract', vendor: str(ss[0].vendor), contract_no: null, amount: amt, message: `${amt} spent with ${str(ss[0].vendor)} and no contract on file.`, fix: 'Put a contract in place, or bid it out; also check the vendor is not excluded from federal programs.' });
    const esc = Math.max(0, ...(C.get(k) || []).map((c) => num(c.escalator_pct) || 0));
    const byCode = new Map(); for (const s of ss) { if (!s.code || num(s.unit_price) === null) continue; const ck = idKey(s.code); if (!byCode.has(ck)) byCode.set(ck, []); byCode.get(ck).push(s); }
    for (const [ck, list] of byCode) {
      list.sort((a, b) => str(isoDate(a.date)).localeCompare(str(isoDate(b.date))));
      const first = num(list[0].unit_price); const last = num(list.at(-1).unit_price);
      const rise = first ? round2((last - first) / first * 100) : 0;
      if (C.has(k) && first && rise > esc + 0.005) items.push({ status: 'price_increase_above_escalator', vendor: str(list[0].vendor), contract_no: str(C.get(k)[0].contract_no) || null, code: str(list[0].code), amount: round2((last - first * (1 + esc / 100)) * (num(list.at(-1).qty) || 1)), increase_pct: rise, escalator_pct: esc, message: `${str(list[0].code)} went from ${first} to ${last} (${rise}%); the contract escalator is ${esc}%.`, fix: 'Ask for the price allowed by the escalator and a credit for the difference.' });
      const p = priceOf.get(`${k}|${ck}`);
      if (p) { const over = list.filter((s) => num(s.unit_price) > num(p.rate) + tolerance); if (over.length) items.push({ status: 'above_contract_rate', vendor: str(list[0].vendor), contract_no: C.has(k) ? str(C.get(k)[0].contract_no) || null : null, code: str(list[0].code), amount: round2(over.reduce((t, s) => t + (num(s.unit_price) - num(p.rate)) * (num(s.qty) || 1), 0)), message: `${over.length} charge(s) for ${str(list[0].code)} above the contract rate of ${num(p.rate)}.`, fix: 'Ask for a credit and correct the vendor\'s price file.' }); }
    }
  }
  sortByStatus(items, ORDER);
  return { as_of: asOf, contracts: contracts.length, vendors_with_spend: byVendor.size, spend: total(spend, (s) => num(s.amount) || 0), by_status: countBy(items, 'status'), items };
}
