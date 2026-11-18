// Beech logic: property company bookkeeping for nursing-home real estate. No I/O.
import { str, num, isoDate, addDays, daysBetween, idKey, monthBounds, sortByStatus, countBy, total, round2 } from 'evergreen-core';

const ORDER = { rent_unpaid: 0, coverage_below: 1, rent_short: 2, escalator_not_billed: 3, financials_missing: 4, occupancy_below: 5, lease_ending: 6 };
const monthsBetween = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

/** Monthly rent due for a period under an annual escalator that steps up on each lease anniversary. */
export function rentDue(lease, period) {
  const start = isoDate(lease.start); const base = num(lease.base_rent) || 0; const esc = (num(lease.escalator_pct) || 0) / 100;
  if (!start) return base; const years = Math.max(0, Math.floor(monthsBetween(start.slice(0, 7), period) / 12));
  return round2(base * (1 + esc) ** years);
}

/**
 * leases: [{ lease_no, operator, facility, start, end, base_rent, escalator_pct, min_coverage, min_occupancy, financials_days, rent_due_day }]
 * rent: [{ lease_no, period, billed, paid, paid_on }]; financials: [{ lease_no, period, ebitdar, rent, occupancy, received_on }]
 */
export function checkPropco(leases, rent, financials, { asOf, endingWarnDays = 365, tolerance = 0.01 } = {}) {
  const items = [];
  // Rent and financial rows grouped by lease once, in file order (filtering both files for every lease took minutes at 10,000 rows).
  const group = (rows) => { const m = new Map(); for (const r of rows) { const k = idKey(r.lease_no); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const rentBy = group(rent); const finBy = group(financials);
  for (const l of leases) {
    const key = idKey(l.lease_no); const base = { lease_no: str(l.lease_no), operator: str(l.operator), facility: str(l.facility) || null };
    const R = rentBy.get(key) || []; const dueDay = num(l.rent_due_day) || 5;
    for (const r of R) {
      const period = str(r.period).slice(0, 7); const billed = num(r.billed) || 0; const paid = num(r.paid) || 0; const due = `${period}-${String(dueDay).padStart(2, '0')}`;
      const exp = rentDue(l, period);
      if (billed + tolerance < exp) items.push({ status: 'escalator_not_billed', ...base, period, amount: round2(exp - billed), expected: exp, billed, message: `${period} rent billed ${billed}; with the ${num(l.escalator_pct) || 0}% escalator it should be ${exp}.`, fix: 'Bill the difference and update the rent schedule.' });
      if (due < asOf && paid <= tolerance && billed > 0) items.push({ status: 'rent_unpaid', ...base, period, amount: billed, days_late: daysBetween(due, asOf), message: `${period} rent of ${billed} is unpaid, ${daysBetween(due, asOf)} days after the due date.`, fix: 'Send the default notice the lease requires and talk to the operator; check the guaranty and the security deposit.' });
      else if (due < asOf && paid + tolerance < billed) items.push({ status: 'rent_short', ...base, period, amount: round2(billed - paid), message: `${period} rent paid ${paid} of ${billed}.`, fix: 'Ask the operator for the balance and the reason.' });
    }
    // Operator financials: coverage on the trailing months received (up to 12), occupancy on the latest month, and months overdue.
    const F = (finBy.get(key) || []).map((f) => ({ ...f, period: str(f.period).slice(0, 7) })).sort((a, b) => a.period.localeCompare(b.period));
    const last12 = F.slice(-12); const eb = last12.reduce((s, f) => s + (num(f.ebitdar) || 0), 0); const rt = last12.reduce((s, f) => s + (num(f.rent) || 0), 0);
    const cov = rt ? round2(eb / rt) : null; const minCov = num(l.min_coverage);
    if (cov !== null && minCov !== null && cov < minCov) items.push({ status: 'coverage_below', ...base, period: last12.at(-1).period, amount: 0, coverage: cov, months: last12.length, message: `${base.operator}'s rent coverage is ${cov}x over ${last12.length} month(s) to ${last12.at(-1).period}; the lease requires ${minCov}x.`, fix: 'Ask the operator for a plan; check the lease default and cure terms and the guaranty.' });
    const occ = num(F.at(-1)?.occupancy); const minOcc = num(l.min_occupancy);
    if (occ !== null && minOcc !== null && occ < minOcc) items.push({ status: 'occupancy_below', ...base, period: F.at(-1).period, amount: 0, occupancy: occ, message: `Occupancy was ${occ}% in ${F.at(-1).period}; the lease minimum is ${minOcc}%.`, fix: 'Ask about admissions and referral sources; watch the next months.' });
    const fd = num(l.financials_days);
    if (fd) {
      const have = new Set(F.map((f) => f.period)); const start = isoDate(l.start);
      let p = (F.at(-1)?.period) || (start ? start.slice(0, 7) : null);
      const missing = [];
      for (let m = p; m; ) { const b = monthBounds(m); if (!b || addDays(b.end, fd) >= asOf) break; if (!have.has(m)) missing.push(m); const nx = addDays(b.end, 1).slice(0, 7); m = nx; if (missing.length > 24) break; }
      if (missing.length) items.push({ status: 'financials_missing', ...base, period: missing.at(-1), amount: 0, months_missing: missing, message: `Operator financials for ${missing.join(', ')} are overdue (due ${fd} days after each month).`, fix: 'Ask the operator for them; most leases make late reporting a default.' });
    }
    const end = isoDate(l.end); if (end && end >= asOf && daysBetween(asOf, end) <= endingWarnDays) items.push({ status: 'lease_ending', ...base, period: null, amount: 0, end, days_left: daysBetween(asOf, end), message: `The lease ends ${end} (${daysBetween(asOf, end)} days).`, fix: 'Start renewal or re-tenanting talks; a change of operator needs a CHOW (olive-of-chow).' });
  }
  sortByStatus(items, ORDER);
  return { as_of: asOf, leases: leases.length, rent_billed: total(rent, (r) => num(r.billed) || 0), rent_collected: total(rent, (r) => num(r.paid) || 0), by_status: countBy(items, 'status'), items };
}
