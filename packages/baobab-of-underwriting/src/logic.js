// Baobab logic: acquisition underwriting packet for one nursing home. Arithmetic only. No I/O.
import { str, num, round2, payerType, monthBounds, sortByStatus, countBy, total, agingBucket } from 'evergreen-core';

const ORDER = { missing_month: 0, rent_coverage_low: 1, staffing_cost_gap: 2, one_time_item: 3, management_fee_normalized: 4, occupancy_below_target: 5, ar_haircut: 6 };
export const GROUPS = Object.freeze(['revenue', 'nursing_labor', 'other_labor', 'non_labor', 'management_fee', 'rent', 'other']);
export const ONE_TIME_WORDS = /settlement|provider relief|\bprf\b|\berc\b|employee retention|insurance (recovery|proceeds)|prior[- ]period|retro(active)?|one[- ]time|non[- ]recurring|gain on sale|ppp/i;
export const DEFAULT_COLLECT = Object.freeze({ medicare_a: [0.98, 0.9, 0.6, 0.2], medicare_b: [0.95, 0.85, 0.5, 0.15], medicaid: [0.97, 0.9, 0.6, 0.25], medicaid_pending: [0.85, 0.7, 0.45, 0.2], managed_care: [0.95, 0.85, 0.55, 0.2], hospice: [0.95, 0.85, 0.5, 0.2], private: [0.9, 0.7, 0.4, 0.1], insurance: [0.9, 0.75, 0.45, 0.15], va: [0.95, 0.85, 0.55, 0.2], unknown: [0.8, 0.6, 0.3, 0.05] });
const bucketIdx = (d) => (d === null ? 3 : d <= 30 ? 0 : d <= 90 ? 1 : d <= 180 ? 2 : 3);
const BUCKETS = ['0-30', '31-90', '91-180', '180+'];
const groupOf = (v) => { const s = str(v).toLowerCase().replace(/[\s-]+/g, '_'); if (GROUPS.includes(s)) return s; if (/rev|income/.test(s)) return 'revenue'; if (/nurs/.test(s)) return 'nursing_labor'; if (/labor|wage|salar|payroll|benefit/.test(s)) return 'other_labor'; if (/manage/.test(s)) return 'management_fee'; if (/rent|lease/.test(s)) return 'rent'; return 'non_labor'; };

/**
 * t12:    [{ month: 'YYYY-MM', account, group, amount, one_time }]   expenses positive
 * census: [{ month, payer, payer_type, days }]
 * ar:     [{ resident_name, payer, payer_type, age_days, balance }]   optional
 * a:      { beds, cap_rate, mgmt_fee_pct=5, revenue_growth_pct=3, expense_growth_pct=4, occupancy_target=0.85, min_rent_coverage=1.3,
 *           staffing: { hprd, hourly_cost }, collect: { payer_type: [4 bucket rates] }, one_time_accounts: [] }
 */
export function underwrite(t12Rows, censusRows, arRows = [], a = {}) {
  const items = [];
  const L = t12Rows.map((r) => ({ month: str(r.month).slice(0, 7), account: str(r.account), group: groupOf(r.group || r.account), amount: num(r.amount) || 0, one_time: /^(y|yes|true|1|x)$/i.test(str(r.one_time)) }));
  const months = [...new Set([...L.map((l) => l.month), ...censusRows.map((c) => str(c.month).slice(0, 7))])].filter((m) => monthBounds(m)).sort();
  const first = months[0]; const lastM = months.at(-1);
  const expected = []; if (lastM) { let [y, m] = lastM.split('-').map(Number); for (let i = 0; i < 12; i++) { expected.unshift(`${y}-${String(m).padStart(2, '0')}`); m--; if (!m) { m = 12; y--; } } }
  for (const m of expected) if (!L.some((l) => l.month === m)) items.push({ status: 'missing_month', month: m, amount: 0, message: `The T12 has no lines for ${m}; recurring lines are annualized from the months given.`, fix: 'Get the missing month from the seller before you rely on the totals.' });
  const isOneTime = (l) => l.one_time || ONE_TIME_WORDS.test(l.account) || (a.one_time_accounts || []).some((x) => str(x).toLowerCase() === l.account.toLowerCase());
  // Recurring lines are annualized when months are missing (12 / months with lines); one-time lines are not.
  const have = new Set(L.map((l) => l.month)).size; const factor = have && have < 12 ? 12 / have : 1;
  const sum = (g, pred = () => true) => round2(L.filter((l) => l.group === g && pred(l)).reduce((s, l) => s + l.amount * (isOneTime(l) ? 1 : factor), 0));
  const byAcct = new Map(); for (const l of L.filter(isOneTime)) { const k = `${l.group}|${l.account}`; byAcct.set(k, { group: l.group, account: l.account, amount: round2((byAcct.get(k)?.amount || 0) + l.amount) }); }
  let adjust = 0;
  for (const x of byAcct.values()) { const sign = x.group === 'revenue' ? -1 : 1; adjust += sign * x.amount; items.push({ status: 'one_time_item', account: x.account, group: x.group, amount: x.amount, message: `${x.account} (${x.group === 'revenue' ? 'revenue' : 'expense'}, ${x.amount}) looks one-time and is ${x.group === 'revenue' ? 'taken out of' : 'added back to'} normalized EBITDAR.`, fix: 'Confirm with the seller\'s ledger detail that it will not recur.' }); }
  const revenue = sum('revenue'); const expenses = round2(['nursing_labor', 'other_labor', 'non_labor', 'management_fee', 'other'].reduce((s, g) => s + sum(g), 0));
  const rent = sum('rent'); const ebitdar = round2(revenue - expenses);
  const mgmtPct = num(a.mgmt_fee_pct) ?? 5; const mgmtNow = sum('management_fee'); const mgmtNorm = round2((revenue - L.filter((l) => l.group === 'revenue' && isOneTime(l)).reduce((s, l) => s + l.amount, 0)) * mgmtPct / 100);
  if (Math.abs(mgmtNorm - mgmtNow) > 1) { adjust += mgmtNow - mgmtNorm; items.push({ status: 'management_fee_normalized', account: 'Management fee', amount: round2(mgmtNorm - mgmtNow), message: `Management fee in the T12 is ${mgmtNow}; at ${mgmtPct}% of revenue it would be ${mgmtNorm}.`, fix: 'Underwrite your own management fee, not the seller\'s.' }); }
  const normalized = round2(ebitdar + adjust);
  // Census, occupancy, payer mix.
  const days = round2(censusRows.reduce((s, c) => s + (num(c.days) || 0), 0));
  const calDays = expected.reduce((s, m) => s + (monthBounds(m)?.days || 0), 0) || months.reduce((s, m) => s + (monthBounds(m)?.days || 0), 0);
  const beds = num(a.beds); const adc = calDays ? round2(days / calDays) : null; const occupancy = beds && calDays ? round2(days / (beds * calDays)) : null;
  const mixM = new Map(); for (const c of censusRows) { const t = payerType(c.payer, c.payer_type); mixM.set(t, (mixM.get(t) || 0) + (num(c.days) || 0)); }
  const payer_mix = [...mixM].map(([payer_type, d]) => ({ payer_type, days: d, share: days ? round2(d / days) : 0 })).sort((x, y) => y.days - x.days);
  const target = num(a.occupancy_target) ?? 0.85;
  if (occupancy !== null && occupancy < target) items.push({ status: 'occupancy_below_target', amount: 0, occupancy, message: `Occupancy is ${round2(occupancy * 100)}% (${adc} average daily census on ${beds} beds), under the ${round2(target * 100)}% target.`, fix: 'Underwrite the census you can prove, and treat fill-up as upside.' });
  // Staffing model.
  let staffing = null;
  if (a.staffing && adc) {
    const hprd = num(a.staffing.hprd); const cost = num(a.staffing.hourly_cost);
    const hoursDay = round2(hprd * adc); const annual = round2(hoursDay * 365 * cost); const actual = sum('nursing_labor');
    staffing = { hprd, adc, hours_per_day: hoursDay, ftes: round2(hoursDay * 365 / 2080), hourly_cost: cost, annual_cost: annual, t12_nursing_labor: actual, gap: round2(annual - actual) };
    if (annual - actual > 1) { adjust -= annual - actual; items.push({ status: 'staffing_cost_gap', amount: round2(annual - actual), message: `Staffing ${hprd} hours per resident day at ${cost} an hour costs ${annual} a year; the T12 shows ${actual} for nursing labor (${round2(annual - actual)} more).`, fix: 'Underwrite the staffing you will run, and check the T12 for unpaid agency or understaffing.' }); }
  }
  const normalizedAfterStaff = round2(ebitdar + adjust);
  // Year one and value.
  const g = (num(a.revenue_growth_pct) ?? 3) / 100; const e = (num(a.expense_growth_pct) ?? 4) / 100;
  const normRevenue = round2(revenue - L.filter((l) => l.group === 'revenue' && isOneTime(l)).reduce((s, l) => s + l.amount, 0));
  const normExpenses = round2(normRevenue - normalizedAfterStaff);
  const y1Revenue = round2(normRevenue * (1 + g)); const y1Expenses = round2(normExpenses * (1 + e)); const y1Ebitdar = round2(y1Revenue - y1Expenses);
  const cap = num(a.cap_rate); const value = cap ? round2(y1Ebitdar / cap) : null;
  const coverage = rent ? round2(normalizedAfterStaff / rent) : null; const minCov = num(a.min_rent_coverage) ?? 1.3;
  if (coverage !== null && coverage < minCov) items.push({ status: 'rent_coverage_low', amount: 0, coverage, message: `Normalized EBITDAR covers rent ${coverage} times; your floor is ${minCov}.`, fix: 'Renegotiate rent, or price the deal on the coverage you need.' });
  // Receivables.
  const collect = { ...DEFAULT_COLLECT, ...(a.collect || {}) };
  const arM = new Map();
  for (const r of arRows) { const t = payerType(r.payer, r.payer_type); const i = bucketIdx(num(r.age_days)); const k = `${t}|${i}`; const x = arM.get(k) || { payer_type: t, bucket: BUCKETS[i], balance: 0, rate: (collect[t] || collect.unknown)[i] }; x.balance = round2(x.balance + (num(r.balance) || 0)); arM.set(k, x); }
  const ar = [...arM.values()].map((x) => ({ ...x, value: round2(Math.max(0, x.balance) * x.rate) })).sort((p, q) => p.payer_type.localeCompare(q.payer_type) || BUCKETS.indexOf(p.bucket) - BUCKETS.indexOf(q.bucket));
  const arGross = total(ar, 'balance'); const arValue = total(ar, 'value');
  const byType = new Map(); for (const x of ar) { const y = byType.get(x.payer_type) || { balance: 0, value: 0 }; y.balance = round2(y.balance + x.balance); y.value = round2(y.value + x.value); byType.set(x.payer_type, y); }
  for (const [t, y] of byType) if (y.balance - y.value > 1) items.push({ status: 'ar_haircut', payer_type: t, amount: round2(y.balance - y.value), message: `${t} receivables of ${y.balance} are worth about ${y.value} at your collection rates (${round2(y.balance - y.value)} less).`, fix: 'Price the receivables at the collectible value, or leave them with the seller.' });
  sortByStatus(items, ORDER);
  return {
    period: { from: expected[0] || first, to: lastM, months_with_lines: have, annualized: factor !== 1 },
    t12: { revenue, expenses, ebitdar, rent, ebitda: round2(ebitdar - rent), adjustments: round2(normalizedAfterStaff - ebitdar), normalized_ebitdar: normalizedAfterStaff, margin: revenue ? round2(normalizedAfterStaff / normRevenue) : null, rent_coverage: coverage },
    census: { patient_days: days, beds, adc, occupancy }, payer_mix, staffing,
    year_one: { revenue: y1Revenue, expenses: y1Expenses, ebitdar: y1Ebitdar, revenue_growth_pct: round2(g * 100), expense_growth_pct: round2(e * 100) },
    valuation: { cap_rate: cap, value, value_per_bed: value && beds ? round2(value / beds) : null, ar_gross: arGross, ar_value: arValue },
    ar, by_status: countBy(items, 'status'), items,
  };
}
export { agingBucket };
