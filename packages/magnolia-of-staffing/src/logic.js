// Magnolia logic: staffing hours per resident day, RN coverage, agency hours and PBJ dates. No I/O.
import { str, num, isoDate, addDays, daysBetween, idKey, payerKey, censusDays, dateRange, sortByStatus, countBy, round2, yes } from 'evergreen-core';

const ORDER = { rn_8_hours_missing: 0, hprd_below_target: 1, agency_hours_differ: 2, pbj_late: 3, pbj_due: 4 };
const mins = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(str(t)); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export const roleOf = (v) => { const s = str(v).toUpperCase().replace(/\./g, ''); if (/\b(RN|DON|ADON|MDS ?COORD|REGISTERED)/.test(s)) return 'rn'; if (/\b(LPN|LVN)/.test(s)) return 'lpn'; if (/\b(CNA|NA|NURSE AIDE|AIDE|MED ?AIDE|CMA|STNA)\b/.test(s)) return 'cna'; return 'other'; };

/** Longest stretch of RN cover in minutes on one date, joining overlapping or touching shifts. Shifts past midnight count on their start date. */
export function longestRnStretch(shifts) {
  const iv = shifts.map((s) => { const a = mins(s.in); let b = mins(s.out); if (a === null || b === null) return null; if (b <= a) b += 1440; return [a, b]; }).filter(Boolean).sort((x, y) => x[0] - y[0]);
  let best = 0; let cur = null;
  for (const [a, b] of iv) { if (cur && a <= cur[1]) cur[1] = Math.max(cur[1], b); else { if (cur) best = Math.max(best, cur[1] - cur[0]); cur = [a, b]; } }
  if (cur) best = Math.max(best, cur[1] - cur[0]);
  return best;
}

/** PBJ due date: 45 days after the end of the federal fiscal quarter that holds the date. */
export function pbjDue(date) { const y = Number(date.slice(0, 4)); const m = Number(date.slice(5, 7)); const qEndMonth = Math.ceil(m / 3) * 3; const end = new Date(Date.UTC(y, qEndMonth, 0)).toISOString().slice(0, 10); return { quarter_end: end, due: addDays(end, 45) }; }

/**
 * time: [{ employee_id, employee_name, role, date, in, out, hours, agency, agency_name }]
 * census rows; invoices: [{ agency, employee_id, employee_name, date, hours }]
 * opts: { start, end, asOf, targets: { total, rn, cna }, pbjSubmitted: { 'YYYY-MM-DD quarter end': date } }
 */
export function checkStaffing(time, census, invoices = [], { start, end, asOf, targets = {}, pbjSubmitted = {}, hoursTolerance = 0.25, pbjWarnDays = 30 } = {}) {
  const days = dateRange(start, end);
  const res = {}; for (const d of censusDays(census, start, end)) if (d.bed_status === 'in_house') res[d.date] = (res[d.date] || 0) + 1;
  const hrs = {}; const rnShifts = {}; const agencyTime = new Map();
  for (const t of time) {
    const date = isoDate(t.date); if (!date || date < start || date > end) continue; const role = roleOf(t.role);
    let h = num(t.hours); if (h === null) { const a = mins(t.in); const b = mins(t.out); if (a !== null && b !== null) h = round2(((b - a + 1440) % 1440) / 60); }
    if (!h) continue;
    hrs[date] ??= { rn: 0, lpn: 0, cna: 0, other: 0 }; hrs[date][role] += h;
    if (role === 'rn') (rnShifts[date] ??= []).push(t);
    if (yes(t.agency) || str(t.agency_name)) { const k = `${payerKey(t.agency_name)}|${idKey(t.employee_id || t.employee_name)}|${date}`; agencyTime.set(k, round2((agencyTime.get(k) || 0) + h)); }
  }
  const items = []; const daily = [];
  for (const d of days) {
    const r = res[d] || 0; const h = hrs[d] || { rn: 0, lpn: 0, cna: 0, other: 0 };
    const row = { date: d, residents: r, rn_hours: round2(h.rn), lpn_hours: round2(h.lpn), cna_hours: round2(h.cna), total_hprd: r ? round2((h.rn + h.lpn + h.cna) / r) : null, rn_hprd: r ? round2(h.rn / r) : null, cna_hprd: r ? round2(h.cna / r) : null, rn_longest_hours: round2(longestRnStretch(rnShifts[d] || []) / 60) };
    daily.push(row);
    if (row.rn_longest_hours < 8) items.push({ status: 'rn_8_hours_missing', date: d, amount: round2(8 - row.rn_longest_hours), message: `On ${d} the longest unbroken RN cover was ${row.rn_longest_hours} hours.`, fix: 'Federal rules require an RN 8 consecutive hours a day, 7 days a week, unless a waiver is in place. Fix the schedule, or check whether a punch is missing.' });
    const short = ['total', 'rn', 'cna'].filter((k) => num(targets[k]) !== null && targets[k] !== undefined && row[`${k}_hprd`] !== null && row[`${k}_hprd`] + 0.0001 < targets[k]);
    if (short.length) items.push({ status: 'hprd_below_target', date: d, amount: 0, short, message: `On ${d}: ${short.map((k) => `${k} ${row[`${k}_hprd`]} against ${targets[k]}`).join('; ')} hours per resident day.`, fix: 'Check the schedule against the census; this feeds the staffing star rating through PBJ.' });
  }
  for (const inv of invoices) {
    const date = isoDate(inv.date); if (!date || date < start || date > end) continue;
    const k = `${payerKey(inv.agency)}|${idKey(inv.employee_id || inv.employee_name)}|${date}`; const billed = num(inv.hours) || 0; const worked = agencyTime.get(k) || 0;
    if (Math.abs(billed - worked) > hoursTolerance) items.push({ status: 'agency_hours_differ', date, agency: str(inv.agency), employee_id: str(inv.employee_id) || null, employee_name: str(inv.employee_name) || null, amount: round2(billed - worked), billed_hours: billed, worked_hours: worked, message: `${str(inv.agency)} billed ${billed} hours on ${date}; our time records show ${worked}.`, fix: billed > worked ? 'Ask the agency for a credit, or find the missing timecard.' : 'Check the invoice; hours may be on another invoice.' });
  }
  const q = pbjDue(end); const sent = isoDate(pbjSubmitted[q.quarter_end]);
  if (!sent) { const left = daysBetween(asOf, q.due); if (left < 0) items.push({ status: 'pbj_late', date: q.due, amount: 0, message: `PBJ for the quarter ending ${q.quarter_end} was due ${q.due} and is not marked submitted.`, fix: 'Submit it now; a missed PBJ deadline drops the staffing star rating to one star.' }); else if (left <= pbjWarnDays) items.push({ status: 'pbj_due', date: q.due, amount: 0, message: `PBJ for the quarter ending ${q.quarter_end} is due ${q.due} (${left} days).`, fix: 'Run the PBJ export, fix its errors and submit before the deadline.' }); }
  sortByStatus(items, ORDER, 'none');
  const tot = (k) => round2(daily.reduce((s, x) => s + x[k], 0)); const rd = daily.reduce((s, x) => s + x.residents, 0);
  return { start, end, resident_days: rd, avg_total_hprd: rd ? round2((tot('rn_hours') + tot('lpn_hours') + tot('cna_hours')) / rd) : null, avg_rn_hprd: rd ? round2(tot('rn_hours') / rd) : null, pbj_quarter_end: q.quarter_end, pbj_due: q.due, daily, by_status: countBy(items, 'status'), items };
}
