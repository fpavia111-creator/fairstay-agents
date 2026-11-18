// Fairstay Payroll Accruals logic: payroll and PTO accruals at month end, as journal entry lines. No I/O.
import { str, num, isoDate, daysBetween, monthBounds, sortByStatus, countBy, round2 } from 'fairstay-core';

const ORDER = { under_accrued: 0, over_accrued: 1, pto_under_accrued: 2, pto_over_accrued: 3 };

/** Share of a pay period that falls on or before month end, by calendar days. */
export function earnedShare(periodStart, periodEnd, monthEnd) {
  const s = isoDate(periodStart); const e = isoDate(periodEnd); if (!s || !e || s > monthEnd) return 0; if (e <= monthEnd) return 1;
  return round2((daysBetween(s, monthEnd) + 1) / (daysBetween(s, e) + 1) * 10000) / 10000;
}

/**
 * register: [{ employee_id, employee_name, department, period_start, period_end, pay_date, gross }]
 * pto: [{ employee_id, department, hours, rate }] at month end; booked: [{ department, kind ('wages' | 'pto'), amount }]
 * opts: { month, employerTaxPct=8.5, tolerance=500, ptoTaxed=true }
 */
export function accruals(register, pto, booked, { month, employerTaxPct = 8.5, tolerance = 500, ptoTaxed = true } = {}) {
  const { end } = monthBounds(month); const tax = employerTaxPct / 100;
  const dep = {}; const D = (d) => (dep[d] ??= { department: d, wages: 0, taxes: 0, wage_accrual: 0, pto_liability: 0, booked_wages: 0, booked_pto: 0 });
  for (const r of register) {
    const pay = isoDate(r.pay_date); if (pay && pay <= end) continue; // paid in the month: already expensed
    const share = earnedShare(r.period_start, r.period_end, end); if (!share) continue;
    const d = D(str(r.department) || 'Unassigned'); const w = (num(r.gross) || 0) * share; d.wages += w; d.taxes += w * tax;
  }
  for (const p of pto) { const d = D(str(p.department) || 'Unassigned'); const v = (num(p.hours) || 0) * (num(p.rate) || 0); d.pto_liability += ptoTaxed ? v * (1 + tax) : v; }
  for (const b of booked) { const d = D(str(b.department) || 'Unassigned'); if (/pto|vacation|leave/i.test(str(b.kind))) d.booked_pto += num(b.amount) || 0; else d.booked_wages += num(b.amount) || 0; }
  const items = []; const journal = [];
  for (const d of Object.values(dep)) {
    for (const k of ['wages', 'taxes', 'pto_liability', 'booked_wages', 'booked_pto']) d[k] = round2(d[k]);
    d.wage_accrual = round2(d.wages + d.taxes);
    const wDiff = round2(d.wage_accrual - d.booked_wages); const pDiff = round2(d.pto_liability - d.booked_pto);
    d.wage_adjustment = wDiff; d.pto_adjustment = pDiff;
    if (Math.abs(wDiff) > tolerance) { items.push({ status: wDiff > 0 ? 'under_accrued' : 'over_accrued', department: d.department, amount: Math.abs(wDiff), calculated: d.wage_accrual, booked: d.booked_wages, message: `${d.department}: wages and employer taxes earned but not paid are ${d.wage_accrual}; ${d.booked_wages} is booked.`, fix: wDiff > 0 ? 'Book the difference to wage expense and accrued payroll.' : 'Reverse the excess accrual.' }); journal.push({ department: d.department, account: 'Wage expense', debit: wDiff > 0 ? wDiff : 0, credit: wDiff < 0 ? -wDiff : 0 }, { department: d.department, account: 'Accrued payroll', debit: wDiff < 0 ? -wDiff : 0, credit: wDiff > 0 ? wDiff : 0 }); }
    if (Math.abs(pDiff) > tolerance) { items.push({ status: pDiff > 0 ? 'pto_under_accrued' : 'pto_over_accrued', department: d.department, amount: Math.abs(pDiff), calculated: d.pto_liability, booked: d.booked_pto, message: `${d.department}: PTO liability is ${d.pto_liability}${ptoTaxed ? ' with employer taxes' : ''}; ${d.booked_pto} is booked.`, fix: 'Adjust the PTO accrual to the liability.' }); journal.push({ department: d.department, account: 'PTO expense', debit: pDiff > 0 ? pDiff : 0, credit: pDiff < 0 ? -pDiff : 0 }, { department: d.department, account: 'Accrued PTO', debit: pDiff < 0 ? -pDiff : 0, credit: pDiff > 0 ? pDiff : 0 }); }
  }
  sortByStatus(items, ORDER);
  const rows = Object.values(dep).sort((a, b) => a.department.localeCompare(b.department));
  const sum = (k) => round2(rows.reduce((s, r) => s + r[k], 0));
  return { month, month_end: end, wage_accrual: sum('wage_accrual'), pto_liability: sum('pto_liability'), booked_wages: sum('booked_wages'), booked_pto: sum('booked_pto'), departments: rows, journal, by_status: countBy(items, 'status'), items };
}
