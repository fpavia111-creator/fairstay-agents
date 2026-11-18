// Holly logic: payroll audit against punches. No I/O.
import { str, num, isoDate, addDays, idKey, sortByStatus, countBy, total, round2 } from 'evergreen-core';

const ORDER = { terminated_paid: 0, ot_underpaid: 1, ot_rate_missing_diff: 2, garnishment_over_limit: 3, hours_differ: 4, missing_punch: 5 };
const mins = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(str(t)); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** Hours for one punch pair; an out time before the in time crosses midnight. */
export function punchHours(inT, outT) { const a = mins(inT); const b = mins(outT); if (a === null || b === null) return null; return round2(((b - a + 1440) % 1440 || 0) / 60); }

/** Overtime hours under a rule for daily hours { date: hours } within one pay period. */
export function overtimeHours(daily, { rule = '40', weekStart = 0, periodStart }) {
  if (rule === '8/80') { let dailyOt = 0; let straight = 0; for (const h of Object.values(daily)) { dailyOt += Math.max(0, h - 8); straight += Math.min(8, h); } return round2(dailyOt + Math.max(0, straight - 80)); }
  const weeks = {}; for (const [d, h] of Object.entries(daily)) { const day = new Date(`${d}T00:00:00Z`).getUTCDay(); const ws = addDays(d, -((day - weekStart + 7) % 7)); weeks[ws] = (weeks[ws] || 0) + h; }
  return round2(Object.values(weeks).reduce((s, h) => s + Math.max(0, h - 40), 0));
}

/**
 * punches: [{ employee_id, employee_name, date, in, out }]
 * register: [{ employee_id, employee_name, pay_date, period_start, period_end, regular_hours, ot_hours, rate, diff_pay, ot_pay, gross, garnishment, garnishment_type, disposable }]
 * employees: [{ employee_id, terminated_on, ot_rule ('40' | '8/80') }]
 */
export function auditPayroll(punches, register, employees = [], { weekStart = 0, hoursTolerance = 0.25, garnishPct = 25, supportPct = 50, defaultRule = '40' } = {}) {
  const E = new Map(employees.map((e) => [idKey(e.employee_id || e.employee_name), e]));
  const items = []; const names = new Map();
  const byEmp = new Map();
  punches.forEach((p, i) => {
    const k = idKey(p.employee_id || p.employee_name); if (p.employee_name) names.set(k, str(p.employee_name));
    const date = isoDate(p.date); const h = punchHours(p.in, p.out);
    if (!str(p.in) || !str(p.out) || h === null) { items.push({ status: 'missing_punch', employee_id: str(p.employee_id) || null, employee_name: str(p.employee_name) || null, date, amount: 0, message: `A ${!str(p.in) ? 'clock-in' : 'clock-out'} is missing on ${date}.`, fix: 'Get the supervisor-approved time correction before payroll closes.', line: i + 1 }); return; }
    const m = byEmp.get(k) || {}; m[date] = (m[date] || 0) + h; byEmp.set(k, m);
  });
  register.forEach((r, i) => {
    const k = idKey(r.employee_id || r.employee_name); const e = E.get(k) || {}; const s = isoDate(r.period_start); const en = isoDate(r.period_end);
    const base = { employee_id: str(r.employee_id) || null, employee_name: str(r.employee_name) || names.get(k) || null, pay_date: isoDate(r.pay_date), period_start: s, period_end: en, line: i + 1 };
    const add = (status, amount, message, fix, extra = {}) => items.push({ status, ...base, amount: round2(amount), message, fix, ...extra });
    const term = isoDate(e.terminated_on);
    if (term && s && s > term) add('terminated_paid', num(r.gross) || 0, `Paid for ${s} to ${en}, after termination on ${term}.`, 'Stop the payment or recover it; check that the employee was removed from the payroll system and the time clock.');
    const reg = num(r.regular_hours) || 0; const ot = num(r.ot_hours) || 0; const paidH = round2(reg + ot); const rate = num(r.rate) || 0; const diff = num(r.diff_pay) || 0;
    const daily = Object.fromEntries(Object.entries(byEmp.get(k) || {}).filter(([d]) => (!s || d >= s) && (!en || d <= en)));
    const punched = round2(Object.values(daily).reduce((t, h) => t + h, 0));
    if (Object.keys(daily).length && Math.abs(punched - paidH) > hoursTolerance) add('hours_differ', Math.abs(punched - paidH) * rate, `Paid ${paidH} hours; the time clock has ${punched}.`, 'Find the edit or missing punch; pay what was worked.', { punched_hours: punched, paid_hours: paidH });
    const rule = str(e.ot_rule) || defaultRule; const owed = Object.keys(daily).length ? overtimeHours(daily, { rule, weekStart, periodStart: s }) : null;
    if (owed !== null && owed - ot > hoursTolerance) add('ot_underpaid', (owed - ot) * rate * 0.5, `${owed} overtime hours under the ${rule === '8/80' ? '8/80' : '40-hour'} rule; ${ot} paid as overtime.`, 'Pay the overtime premium on the next check and check the timekeeping rule set up for this employee.', { ot_owed: owed, ot_paid: ot, rule });
    const otPay = num(r.ot_pay);
    if (ot > 0 && otPay !== null && paidH > 0 && diff > 0) {
      const regularRate = (rate * paidH + diff) / paidH; const due = round2(1.5 * regularRate * ot);
      if (otPay + 0.01 < due) add('ot_rate_missing_diff', due - otPay, `Overtime paid ${otPay}; with shift differentials in the regular rate it should be ${due}.`, 'Include differentials (and other non-discretionary pay) in the regular rate for overtime.', { regular_rate: round2(regularRate) });
    }
    const g = num(r.garnishment); const disp = num(r.disposable);
    if (g && disp) { const pct = /support|child|alimony/i.test(str(r.garnishment_type)) ? supportPct : garnishPct; const cap = round2(disp * pct / 100); if (g > cap + 0.01) add('garnishment_over_limit', g - cap, `Withheld ${g}; the ${pct}% limit on ${disp} disposable earnings is ${cap}.`, 'Check the order and the federal and state limits, then refund the excess.', { limit_pct: pct }); }
  });
  sortByStatus(items, ORDER);
  return { employees_paid: new Set(register.map((r) => idKey(r.employee_id || r.employee_name))).size, gross: total(register, (r) => num(r.gross) || 0), at_risk: total(items, 'amount'), by_status: countBy(items, 'status'), items };
}
