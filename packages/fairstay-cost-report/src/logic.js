// Fairstay Cost Report logic: patient days tie-out and the prepared-by-client list. No I/O.
import { str, num, isoDate, daysBetween, payerType, censusDays, sortByStatus, countBy, round2 } from 'fairstay-core';

const ORDER = { total_days_differ: 0, days_differ_cost_report: 1, days_differ_psr: 2, pbc_overdue: 3, pbc_due_soon: 4 };
const GROUP = { medicare_a: 'medicare_a', medicaid: 'medicaid', medicaid_pending: 'medicaid', managed_care: 'other', private: 'other', insurance: 'other', hospice: 'other', va: 'other', medicare_b: 'other', unknown: 'other' };

/**
 * census rows for the fiscal year; costReport: [{ payer_type (medicare_a | medicaid | other | total), days }]; psr: [{ days }] (Medicare A covered days);
 * pbc: [{ item, requested_by, owner, due, received_on }]
 * opts: { start, end, asOf, tolerance=0, countLeaveDays=true }
 */
export function tieOut(census, costReport, psr = [], pbc = [], { start, end, asOf, tolerance = 0, countLeaveDays = true } = {}) {
  const days = censusDays(census, start, end).filter((d) => d.bed_status === 'in_house' || (countLeaveDays && d.bed_status !== 'discharged'));
  const fromCensus = { medicare_a: 0, medicaid: 0, other: 0 }; for (const d of days) fromCensus[GROUP[d.payer_type] || 'other']++;
  const total = days.length;
  const cr = {}; for (const r of costReport) { const t = str(r.payer_type).toLowerCase(); const k = t === 'total' ? 'total' : GROUP[payerType(t, t)] || t; cr[k] = (cr[k] || 0) + (num(r.days) || 0); }
  const items = []; const table = [];
  for (const k of ['medicare_a', 'medicaid', 'other']) {
    const c = fromCensus[k]; const r = cr[k] ?? null; table.push({ group: k, census_days: c, cost_report_days: r, difference: r === null ? null : r - c });
    if (r !== null && Math.abs(r - c) > tolerance) items.push({ status: 'days_differ_cost_report', group: k, census_days: c, other_days: r, amount: Math.abs(r - c), message: `${k} days: census ${c}, cost report ${r} (${r - c > 0 ? '+' : ''}${r - c}).`, fix: 'Find the difference (late census changes, leave days, payer changes) before the cost report is filed; days drive the Medicare and Medicaid cost per day.' });
  }
  const crTotal = cr.total ?? (['medicare_a', 'medicaid', 'other'].every((k) => cr[k] !== undefined) ? cr.medicare_a + cr.medicaid + cr.other : null);
  table.push({ group: 'total', census_days: total, cost_report_days: crTotal, difference: crTotal === null ? null : crTotal - total });
  if (crTotal !== null && Math.abs(crTotal - total) > tolerance) items.unshift({ status: 'total_days_differ', group: 'total', census_days: total, other_days: crTotal, amount: Math.abs(crTotal - total), message: `Total patient days: census ${total}, cost report ${crTotal}.`, fix: 'Tie total days first; the payer split cannot be right until the total is.' });
  const psrDays = psr.length ? psr.reduce((s, r) => s + (num(r.days) || 0), 0) : null;
  if (psrDays !== null) { table.push({ group: 'medicare_a_psr', census_days: fromCensus.medicare_a, cost_report_days: psrDays, difference: psrDays - fromCensus.medicare_a }); if (Math.abs(psrDays - fromCensus.medicare_a) > tolerance) items.push({ status: 'days_differ_psr', group: 'medicare_a', census_days: fromCensus.medicare_a, other_days: psrDays, amount: Math.abs(psrDays - fromCensus.medicare_a), message: `Medicare A days: census ${fromCensus.medicare_a}, PS&R ${psrDays}.`, fix: psrDays < fromCensus.medicare_a ? 'Days on the census not on the PS&R are usually unbilled, rejected or denied claims; bill or document them.' : 'PS&R days above the census can mean claims billed for days the resident was not here.' }); }
  for (const p of pbc) {
    const due = isoDate(p.due); if (!due || isoDate(p.received_on)) continue; const left = daysBetween(asOf, due);
    const base = { item: str(p.item), requested_by: str(p.requested_by) || null, item_owner: str(p.owner) || null, due_date: due, amount: 0 };
    if (left < 0) items.push({ status: 'pbc_overdue', ...base, message: `"${base.item}" for ${base.requested_by || 'the auditors'} was due ${due} (${-left} days ago).`, fix: 'Send it or agree a new date; late PBC items stretch the audit and its fee.' });
    else if (left <= 7) items.push({ status: 'pbc_due_soon', ...base, message: `"${base.item}" for ${base.requested_by || 'the auditors'} is due ${due}.`, fix: 'Check the owner has it ready.' });
  }
  sortByStatus(items, ORDER);
  return { start, end, total_days: total, census_days_by_group: fromCensus, tie_out: table, pbc_open: pbc.filter((p) => !isoDate(p.received_on)).length, by_status: countBy(items, 'status'), items };
}
