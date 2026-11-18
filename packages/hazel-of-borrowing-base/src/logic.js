// Hazel logic: borrowing base certificate preparation. Arithmetic on your loan terms. No I/O.
import { str, num, isoDate, daysBetween, payerKey, payerType, idKey, sortByStatus, countBy, round2 } from 'evergreen-core';

const ORDER = { over_line: 0, concentration_excess: 1, cross_aged: 2, over_age: 3, medicaid_pending: 4, credit_balance: 5, no_advance_rate: 6 };
export const DEFAULT_TERMS = Object.freeze({ advance_rates: { medicare_a: 0.85, medicare_b: 0.85, medicaid: 0.85, managed_care: 0.8, insurance: 0.75, va: 0.8, hospice: 0.75, private: 0.5 }, max_age_days: { default: 120, private: 90 }, cross_age_pct: 50, concentration_pct: 25, ineligible_types: ['medicaid_pending', 'unknown'] });

/**
 * ar: [{ resident_id, resident_name, payer, payer_type, service_date (or to), balance }]
 * terms: { advance_rates, max_age_days, cross_age_pct, concentration_pct, ineligible_types, line_limit, outstanding }
 */
export function borrowingBase(ar, { asOf, terms = {} } = {}) {
  const T = { ...DEFAULT_TERMS, ...terms, advance_rates: { ...DEFAULT_TERMS.advance_rates, ...(terms.advance_rates || {}) }, max_age_days: { ...DEFAULT_TERMS.max_age_days, ...(terms.max_age_days || {}) } };
  const rows = ar.map((r, i) => { const type = payerType(r.payer, r.payer_type); const d = isoDate(r.service_date) || isoDate(r.to) || isoDate(r.from); return { resident_id: str(r.resident_id) || str(r.resident_name), resident_name: str(r.resident_name) || null, payer: str(r.payer), payer_type: type, date: d, age: d ? daysBetween(d, asOf) : null, balance: num(r.balance) || 0, line: i + 1, reason: null }; });
  const maxAge = (t) => T.max_age_days[t] ?? T.max_age_days.default;
  // Cross-aging: when a debtor (resident for private pay, payer otherwise) has more than cross_age_pct of its balance over age, all of it is ineligible.
  const debtor = (r) => (r.payer_type === 'private' ? `res|${idKey(r.resident_id)}` : `pay|${payerKey(r.payer)}`);
  const agg = new Map(); for (const r of rows) { if (r.balance <= 0) continue; const k = debtor(r); const a = agg.get(k) || { all: 0, old: 0 }; a.all += r.balance; if (r.age !== null && r.age > maxAge(r.payer_type)) a.old += r.balance; agg.set(k, a); }
  for (const r of rows) {
    if (r.balance < 0) r.reason = 'credit_balance';
    else if (T.ineligible_types.includes(r.payer_type)) r.reason = r.payer_type === 'medicaid_pending' ? 'medicaid_pending' : 'no_advance_rate';
    else if (T.advance_rates[r.payer_type] === undefined) r.reason = 'no_advance_rate';
    else if (r.age === null || r.age > maxAge(r.payer_type)) r.reason = 'over_age';
    else { const a = agg.get(debtor(r)); if (a && a.old / a.all * 100 > T.cross_age_pct) r.reason = 'cross_aged'; }
  }
  // Gross is debit balances; credit balances come off as an ineligible, as most lenders count them.
  const gross = round2(rows.reduce((s, r) => s + Math.max(0, r.balance), 0));
  let eligible = rows.filter((r) => !r.reason);
  // Concentration: any one payer (not Medicare or Medicaid) above concentration_pct of eligible receivables; the excess is ineligible.
  const elTotal = eligible.reduce((s, r) => s + r.balance, 0); const conc = [];
  const byPayer = new Map(); for (const r of eligible) if (!['medicare_a', 'medicare_b', 'medicaid', 'private'].includes(r.payer_type)) byPayer.set(payerKey(r.payer), [...(byPayer.get(payerKey(r.payer)) || []), r]);
  for (const [, rs] of byPayer) { const amt = rs.reduce((s, r) => s + r.balance, 0); const cap = elTotal * T.concentration_pct / 100; if (amt > cap) conc.push({ payer: rs[0].payer, payer_type: rs[0].payer_type, amount: round2(amt - cap), share: round2(amt / elTotal * 100) }); }
  const byType = {}; const add = (t, k, v) => { byType[t] ??= { payer_type: t, gross: 0, ineligible: 0, eligible: 0, advance_rate: T.advance_rates[t] ?? 0, availability: 0 }; byType[t][k] = round2(byType[t][k] + v); };
  for (const r of rows) { if (r.balance < 0) { add(r.payer_type, 'gross', 0); add(r.payer_type, 'ineligible', -r.balance); add(r.payer_type, 'eligible', r.balance); continue; } add(r.payer_type, 'gross', r.balance); if (r.reason) add(r.payer_type, 'ineligible', r.balance); else add(r.payer_type, 'eligible', r.balance); }
  for (const c of conc) { add(c.payer_type, 'ineligible', c.amount); add(c.payer_type, 'eligible', -c.amount); }
  for (const t of Object.values(byType)) t.availability = round2(Math.max(0, t.eligible) * t.advance_rate);
  const ineligibles = {}; for (const r of rows) if (r.reason) ineligibles[r.reason] = round2((ineligibles[r.reason] || 0) + Math.abs(r.balance));
  for (const c of conc) ineligibles.concentration_excess = round2((ineligibles.concentration_excess || 0) + c.amount);
  const base = round2(Object.values(byType).reduce((s, t) => s + t.availability, 0));
  const limit = num(T.line_limit); const out = num(T.outstanding) ?? 0;
  const available = round2((limit !== null ? Math.min(base, limit) : base) - out);
  const T2 = { over_age: 'Over the age limit for its payer type.', medicaid_pending: 'Medicaid pending is not eligible.', credit_balance: 'A credit balance comes off eligible receivables.', cross_aged: 'Most of this debtor\'s balance is over age, so all of it is out.', no_advance_rate: 'No advance rate for this payer type.' };
  const items = rows.filter((r) => r.reason).map((r) => ({ status: r.reason, resident_id: r.resident_id, resident_name: r.resident_name, payer: r.payer, payer_type: r.payer_type, date: r.date, age_days: r.age, amount: Math.abs(r.balance), balance: r.balance, message: T2[r.reason], fix: r.reason === 'over_age' || r.reason === 'cross_aged' ? 'Collect or write off; it stays out of the base until then.' : 'Leave out of the base; work the account in collections.' }));
  for (const c of conc) items.push({ status: 'concentration_excess', resident_id: null, resident_name: null, payer: c.payer, payer_type: c.payer_type, amount: c.amount, message: `${c.payer} is ${c.share}% of eligible receivables; the excess over ${T.concentration_pct}% is out.`, fix: 'Check the concentration limit in your loan agreement; some lenders allow more for rated plans.' });
  if (available < 0) items.push({ status: 'over_line', resident_id: null, resident_name: null, payer: null, amount: -available, message: `The loan balance is ${-available} more than the base supports.`, fix: 'Pay down the line by this amount or talk to the lender before the certificate is due.' });
  sortByStatus(items, ORDER);
  return { as_of: asOf, gross_ar: gross, ineligible: round2(gross - Object.values(byType).reduce((s, t) => s + t.eligible, 0)), eligible: round2(Object.values(byType).reduce((s, t) => s + t.eligible, 0)), borrowing_base: base, line_limit: limit, outstanding: out, available, by_payer_type: Object.values(byType).sort((a, b) => b.gross - a.gross), ineligibles, by_status: countBy(items, 'status'), items };
}
