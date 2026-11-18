// Mulberry logic: managed care contract review and payer matrix. No I/O.
import { str, num, isoDate, addDays, daysBetween, payerKey, round2, sortByStatus, countBy, total } from 'evergreen-core';

const ORDER = { paid_below_contract: 0, contract_expired: 1, no_contract: 2, notice_window_open: 3, below_benchmark: 4, rate_unchanged: 5 };
const lv = (v) => str(v).toUpperCase();

/** Contract rate for payer + level on a date (a blank level on the contract covers every level). */
export function contractFor(contracts, payer, level, date) {
  const pk = payerKey(payer); let best = null;
  for (const c of contracts) {
    if (payerKey(c.payer) !== pk) continue;
    if (c.level && lv(c.level) !== lv(level)) continue;
    if (date && c.start && c.start > date) continue;
    if (date && c.end && c.end < date && !c.auto_renew) continue;
    if (!best || (c.level && !best.level) || (c.start || '') > (best.start || '')) best = c;
  }
  return best;
}

/**
 * contracts: [{ payer, plan, level, rate, start, end, auto_renew, notice_days, last_rate_change }]
 * payments:  [{ payer, level, resident_name, claim_id, from, days, paid }]
 * opts: { asOf, benchmarks: [{ level, rate }], warnDays=30, staleYears=2, tolerance=0.01 }
 */
export function reviewMco(contractRows, paymentRows = [], { asOf, benchmarks = [], warnDays = 30, staleYears = 2, tolerance = 0.01 } = {}) {
  const yes = (v) => /^(y|yes|true|1|x)$/i.test(str(v));
  const C = contractRows.map((r) => ({ payer: str(r.payer), plan: str(r.plan) || null, level: str(r.level) || null, rate: num(r.rate), start: isoDate(r.start), end: isoDate(r.end), auto_renew: yes(r.auto_renew), notice_days: num(r.notice_days) ?? 90, last_rate_change: isoDate(r.last_rate_change) || isoDate(r.start) }));
  const bench = (level) => { const b = benchmarks.find((x) => lv(x.level) === lv(level)) || benchmarks.find((x) => !x.level); return b ? num(b.rate) : null; };
  const items = [];
  const base = (c) => ({ payer: c.payer, plan: c.plan, level: c.level, rate: c.rate, start: c.start, end: c.end });
  // Contracts grouped by payer once; payment lines look up only their payer's contracts.
  const byPayer = new Map(); for (const c of C) { const k = payerKey(c.payer); if (!byPayer.has(k)) byPayer.set(k, []); byPayer.get(k).push(c); }
  const payers = [...byPayer.keys()];
  for (const pk of payers) {
    const mine = byPayer.get(pk);
    const latestEnd = mine.map((c) => c.end).filter(Boolean).sort().at(-1);
    const openEnded = mine.some((c) => !c.end);
    const c0 = mine.find((c) => c.end === latestEnd) || mine[0];
    if (!openEnded && latestEnd) {
      const left = daysBetween(asOf, latestEnd);
      if (left < 0 && !c0.auto_renew) items.push({ status: 'contract_expired', ...base(c0), level: null, days_left: left, amount: 0, message: `The ${c0.payer} contract ended ${latestEnd} and does not renew on its own.`, fix: 'Stop admitting on it until a new contract or an extension is signed, or confirm an out-of-network rate in writing.' });
      else if (c0.auto_renew) {
        const noticeBy = addDays(latestEnd, -c0.notice_days); const nl = daysBetween(asOf, noticeBy);
        if (left >= 0 && nl >= 0 && nl <= warnDays) items.push({ status: 'notice_window_open', ...base(c0), level: null, notice_by: noticeBy, days_left: nl, amount: 0, message: `The ${c0.payer} contract renews on ${latestEnd} unless notice is given by ${noticeBy} (${nl} days).`, fix: 'Decide now: renegotiate rates, send notice, or let it renew.' });
      } else if (left >= 0 && left <= warnDays) items.push({ status: 'notice_window_open', ...base(c0), level: null, notice_by: latestEnd, days_left: left, amount: 0, message: `The ${c0.payer} contract ends ${latestEnd} (${left} days) with no automatic renewal.`, fix: 'Get the renewal signed before it ends.' });
    }
  }
  const paidDays = new Map();
  for (const p of paymentRows) { const k = `${payerKey(p.payer)}|${lv(p.level)}`; paidDays.set(k, (paidDays.get(k) || 0) + (num(p.days) || 0)); }
  for (const c of C) {
    if (c.end && c.end < asOf && !c.auto_renew) continue;
    const b = c.level ? bench(c.level) : null;
    if (b !== null && c.rate !== null && c.rate < b - tolerance) {
      const days = paidDays.get(`${payerKey(c.payer)}|${lv(c.level)}`) || 0;
      items.push({ status: 'below_benchmark', ...base(c), benchmark: b, gap_per_day: round2(b - c.rate), days_left: null, amount: round2((b - c.rate) * days), message: `${c.payer} pays ${c.rate} a day for ${c.level}; your benchmark is ${b} (${round2(b - c.rate)} a day less${days ? `, ${round2((b - c.rate) * days)} on ${days} paid day(s) in the file` : ''}).`, fix: 'Bring this to the next rate negotiation with your cost per day.' });
    }
    if (c.last_rate_change && daysBetween(c.last_rate_change, asOf) > staleYears * 365) items.push({ status: 'rate_unchanged', ...base(c), last_rate_change: c.last_rate_change, days_left: null, amount: 0, message: `The ${c.payer}${c.level ? ` ${c.level}` : ''} rate has not changed since ${c.last_rate_change}.`, fix: 'Ask for an increase; costs have moved since then.' });
  }
  const noContract = new Map();
  paymentRows.forEach((p, i) => {
    const from = isoDate(p.from); const days = num(p.days) || 0; const paid = num(p.paid);
    const c = contractFor(byPayer.get(payerKey(p.payer)) || [], p.payer, p.level, from);
    if (!c) { const k = payerKey(p.payer); const x = noContract.get(k) || { payer: str(p.payer), days: 0, paid: 0, lines: 0 }; x.days += days; x.paid = round2(x.paid + (paid || 0)); x.lines++; noContract.set(k, x); return; }
    if (c.rate === null || paid === null || !days) return;
    const due = round2(c.rate * days);
    if (paid < due - tolerance) items.push({ status: 'paid_below_contract', payer: str(p.payer), plan: c.plan, level: str(p.level) || c.level, rate: c.rate, resident_name: str(p.resident_name) || null, claim_id: str(p.claim_id) || null, from, days, paid, expected: due, days_left: null, amount: round2(due - paid), line: i + 1, message: `${str(p.payer)} paid ${paid} for ${days} day(s) from ${from}${p.level ? ` at ${str(p.level)}` : ''}; the contract is ${c.rate} a day (${due}).`, fix: 'Dispute the underpayment with the plan, citing the contract rate and effective date.' });
  });
  for (const x of noContract.values()) items.push({ status: 'no_contract', payer: x.payer, plan: null, level: null, rate: null, days_left: null, days: x.days, amount: 0, paid: x.paid, message: `${x.payer} paid ${x.lines} claim line(s) (${x.days} days, ${x.paid}) and there is ${C.some((c) => payerKey(c.payer) === payerKey(x.payer)) ? 'only an ended contract' : 'no contract'} on file for those dates.`, fix: 'Find the contract or a single-case agreement, and add it, or treat the plan as out of network.' });
  sortByStatus(items, ORDER);
  // Payer matrix for admissions: one row per payer and level.
  const matrix = C.map((c) => { const ended = c.end && c.end < asOf && !c.auto_renew; return { payer: c.payer, plan: c.plan || '', level: c.level || 'all', rate: c.rate, benchmark: c.level ? bench(c.level) : null, network: ended ? 'expired' : 'in network', ends: c.end || '', auto_renew: c.auto_renew ? 'yes' : 'no' }; }).sort((a, b) => a.payer.localeCompare(b.payer) || a.level.localeCompare(b.level));
  return { as_of: asOf, contracts: C.length, payers: payers.length, payment_lines: paymentRows.length, underpaid: total(items.filter((i) => i.status === 'paid_below_contract'), 'amount'), below_benchmark: total(items.filter((i) => i.status === 'below_benchmark'), 'amount'), by_status: countBy(items, 'status'), matrix, items };
}
