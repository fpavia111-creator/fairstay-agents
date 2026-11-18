// Fairstay Covenant Tests logic: loan and lease covenant tests. Arithmetic on your statements. No I/O.
import { str, num, isoDate, addDays, daysBetween, monthBounds, sortByStatus, countBy, round2 } from 'fairstay-core';

const ORDER = { breach: 0, reporting_late: 1, near_miss: 2, reporting_due: 3, no_data: 4, pass: 5 };
export const TESTS = Object.freeze(['occupancy', 'rent_coverage', 'dscr', 'fccr', 'days_cash']);
const MONTHS = { month: 1, quarter: 3, ttm: 12 };

/** Ratio for one test over a list of monthly rows (oldest first). */
export function measure(test, rows) {
  const sum = (k) => rows.reduce((s, r) => s + (num(r[k]) || 0), 0); const last = rows.at(-1) || {};
  const days = rows.reduce((s, r) => s + (num(r.days) || monthBounds(r.period)?.days || 0), 0);
  const ratio = (a, b) => (b ? round2(a / b) : null);
  switch (test) {
    case 'occupancy': { const beds = num(last.beds); return beds && days ? round2(sum('patient_days') / (beds * days) * 100) : null; }
    case 'rent_coverage': return ratio(sum('ebitdar'), sum('rent'));
    case 'dscr': return ratio(sum('ebitdar') - sum('rent'), sum('interest') + sum('principal'));
    case 'fccr': return ratio(sum('ebitdar'), sum('rent') + sum('interest') + sum('principal'));
    case 'days_cash': { const opex = sum('operating_expenses'); return opex && days ? round2((num(last.cash) || 0) / (opex / days)) : null; }
    default: return null;
  }
}

/**
 * financials: monthly rows [{ period 'YYYY-MM', beds, patient_days, ebitdar, rent, interest, principal, operating_expenses, cash }]
 * covenants: [{ name, loan, test, min, period: month|quarter|ttm, reporting_days, delivered_on }]
 */
export function testCovenants(financials, covenants, { asOf, period, warnPct = 10, dueWarnDays = 14 } = {}) {
  const rows = financials.map((r) => ({ ...r, period: str(r.period).slice(0, 7) })).filter((r) => /^\d{4}-\d{2}$/.test(r.period)).sort((a, b) => a.period.localeCompare(b.period));
  const at = period || rows.at(-1)?.period; const end = monthBounds(at)?.end;
  const items = [];
  for (const c of covenants) {
    const test = str(c.test).toLowerCase(); const span = MONTHS[str(c.period).toLowerCase() || 'ttm'] || 12; const min = num(c.min);
    const use = rows.filter((r) => r.period <= at).slice(-span);
    const base = { name: str(c.name) || test, loan: str(c.loan) || null, test, period: at, months: use.length, minimum: min };
    const value = use.length === span ? measure(test, use) : null;
    if (value === null) items.push({ status: 'no_data', ...base, value: null, cushion_pct: null, message: `Not enough data for ${base.name}: ${use.length} of ${span} month(s), or a needed column is blank.`, fix: 'Add the missing months or columns to the financials.' });
    else {
      const cushion = min ? round2((value - min) / min * 100) : null;
      const status = min !== null && value < min ? 'breach' : cushion !== null && cushion < warnPct ? 'near_miss' : 'pass';
      const unit = test === 'occupancy' ? '%' : test === 'days_cash' ? ' days' : 'x';
      items.push({ status, ...base, value, cushion_pct: cushion, message: `${base.name}: ${value}${unit} against a ${min}${unit} minimum (${span === 12 ? 'trailing 12 months' : span === 3 ? 'quarter' : 'month'} to ${at}).`, fix: status === 'breach' ? 'Talk to the lender or landlord before the compliance certificate is due; ask about a cure, waiver or amendment.' : status === 'near_miss' ? `The cushion is ${cushion}%; check what would push it under next period.` : 'No action.' });
    }
    const rd = num(c.reporting_days);
    if (rd && end) {
      const due = addDays(end, rd); const left = daysBetween(asOf, due); const delivered = isoDate(c.delivered_on);
      if (!delivered && left < 0) items.push({ status: 'reporting_late', ...base, value: null, due_date: due, message: `${base.name} reporting for ${at} was due ${due} (${-left} days ago).`, fix: 'Send the compliance certificate now; late reporting is usually a default by itself.' });
      else if (!delivered && left <= dueWarnDays) items.push({ status: 'reporting_due', ...base, value: null, due_date: due, message: `${base.name} reporting for ${at} is due ${due} (${left} days).`, fix: 'Close the month and prepare the certificate.' });
    }
  }
  sortByStatus(items, ORDER, 'none');
  return { as_of: asOf, period: at, covenants: covenants.length, by_status: countBy(items, 'status'), items };
}
