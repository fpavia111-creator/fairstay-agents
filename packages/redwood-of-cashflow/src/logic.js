// Redwood logic: 13-week cash projection. Arithmetic on the numbers given, not a forecast. No I/O.
import { str, num, isoDate, addDays, payerType, countBy, round2 } from 'evergreen-core';

/**
 * opening: [{ account, balance }]; ar: [{ payer, payer_type, amount }]; bills: [{ vendor, due_date, amount }]
 * plan: {
 *   collect: { payer_type: { pct, weeks } }        share of today's AR collected, spread evenly over the next `weeks` weeks
 *   weekly_billing: { payer_type: amount }         new revenue billed each week, collected `lag_weeks` later at `pct`
 *   lag: { payer_type: { pct, lag_weeks } }
 *   payroll: { amount, first_date, every_days=14 }
 *   fixed: [{ name, amount, day_of_month }]        rent, provider tax, loan payments
 *   min_cash
 * }
 */
export function projectCash(opening, ar, bills, plan = {}, { start, weeks = 13 } = {}) {
  const W = Array.from({ length: weeks }, (_, i) => ({ week: i + 1, start: addDays(start, i * 7), end: addDays(start, i * 7 + 6), ar_collections: 0, new_collections: 0, payroll: 0, bills: 0, fixed: 0 }));
  const weekOf = (date) => { const d = isoDate(date); if (!d) return null; if (d < start) return 0; const i = Math.floor((Date.parse(d) - Date.parse(start)) / 86400000 / 7); return i < weeks ? i : null; };
  const open = round2(opening.reduce((s, r) => s + (num(r.balance) || 0), 0));
  const collect = plan.collect || {}; const unknown = new Set();
  const arByType = {};
  for (const r of ar) { const t = payerType(r.payer, r.payer_type); arByType[t] = round2((arByType[t] || 0) + (num(r.amount) || 0)); }
  for (const [t, amt] of Object.entries(arByType)) {
    const c = collect[t]; if (!c) { unknown.add(t); continue; }
    const n = Math.max(1, Math.min(weeks, c.weeks || 1)); const per = amt * (c.pct ?? 1) / n;
    for (let i = 0; i < n; i++) W[i].ar_collections += per;
  }
  for (const [t, amt] of Object.entries(plan.weekly_billing || {})) {
    const l = (plan.lag || {})[t] || { pct: 1, lag_weeks: 4 };
    for (let i = 0; i < weeks; i++) { const j = i + (l.lag_weeks ?? 4); if (j < weeks) W[j].new_collections += amt * (l.pct ?? 1); }
  }
  if (plan.payroll && plan.payroll.amount && plan.payroll.first_date) {
    for (let d = isoDate(plan.payroll.first_date); d <= W.at(-1).end; d = addDays(d, plan.payroll.every_days || 14)) { const i = weekOf(d); if (i !== null && d >= start) W[i].payroll += plan.payroll.amount; }
  }
  let pastDue = 0;
  for (const b of bills) { const i = weekOf(b.due_date); if (i === null) continue; if (isoDate(b.due_date) < start) pastDue += num(b.amount) || 0; W[i].bills += num(b.amount) || 0; }
  for (const f of plan.fixed || []) {
    for (const w of W) for (let d = w.start; d <= w.end; d = addDays(d, 1)) if (Number(d.slice(8)) === f.day_of_month) w.fixed += f.amount;
  }
  let cash = open; const min = plan.min_cash ?? 0; const items = [];
  for (const w of W) {
    for (const k of ['ar_collections', 'new_collections', 'payroll', 'bills', 'fixed']) w[k] = round2(w[k]);
    w.receipts = round2(w.ar_collections + w.new_collections); w.disbursements = round2(w.payroll + w.bills + w.fixed);
    w.net = round2(w.receipts - w.disbursements); w.opening = round2(cash); cash = round2(cash + w.net); w.ending = cash;
    if (cash < 0) items.push({ status: 'negative_cash', week: w.week, start: w.start, end: w.end, ending: cash, amount: round2(min - cash), message: `Week ${w.week} (${w.start}) ends at ${cash}: the account would be overdrawn.`, fix: 'Draw on the line, move a payment date, or speed up a collection before this week.' });
    else if (cash < min) items.push({ status: 'below_minimum', week: w.week, start: w.start, end: w.end, ending: cash, amount: round2(min - cash), message: `Week ${w.week} (${w.start}) ends at ${cash}, ${round2(min - cash)} below your ${min} minimum.`, fix: 'Plan the draw or the timing change now.' });
  }
  if (pastDue) items.push({ status: 'past_due_bills', week: 1, start, end: W[0].end, ending: W[0].ending, amount: round2(pastDue), message: `${round2(pastDue)} of bills are already past due and are counted in week 1.`, fix: 'Agree payment dates with those vendors so week 1 is real.' });
  for (const t of unknown) items.push({ status: 'no_collection_rate', week: null, start, end: null, ending: null, amount: arByType[t], message: `${arByType[t]} of ${t} receivables have no collection rate, so they are left out.`, fix: `Add a collect rate for ${t} to the plan file.` });
  const low = W.reduce((a, w) => (w.ending < a.ending ? w : a), W[0]);
  return { start, weeks, opening_cash: open, ending_cash: cash, lowest_week: low.week, lowest_cash: low.ending, min_cash: min, receipts: round2(W.reduce((s, w) => s + w.receipts, 0)), disbursements: round2(W.reduce((s, w) => s + w.disbursements, 0)), projection: W, by_status: countBy(items, 'status'), items };
}
