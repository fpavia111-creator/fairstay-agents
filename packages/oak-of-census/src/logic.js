// Oak logic: the census against what was billed, day by day. No I/O.
import { str, num, isoDate, payerKey, round2, censusDays, dateRange, dayRuns, rateFor, payerType, sortByStatus, countBy, total, monthBounds } from 'evergreen-core';

const ORDER = { wrong_payer: 0, unbilled: 1, billed_not_in_census: 2, bed_hold_billed: 3, duplicate_billed: 4, census_overlap: 5, level_mismatch: 6, rate_mismatch: 7 };

/** Billed lines -> one record per billed day (service dates are inclusive on claims and invoices). */
export function billedDays(rows, start, end) {
  const out = [];
  rows.forEach((r, i) => {
    const from = isoDate(r.from); if (!from) return;
    const to = isoDate(r.to) || from;
    for (const date of dateRange(from, to)) {
      if ((start && date < start) || (end && date > end)) continue;
      out.push({ resident_id: str(r.resident_id) || str(r.resident_name), resident_name: str(r.resident_name) || null, date, payer: str(r.payer) || null, payer_type: payerType(r.payer, r.payer_type), level: str(r.level) || null, line: i + 1, claim_id: str(r.claim_id) || null });
    }
  });
  return out;
}

/**
 * Compare census and billing for [start, end].
 * opts: { rates: [{payer?, payer_type?, level?, rate}], bedHoldPayers: [payer names or payer types], factPayers: accepted bed-hold facts }
 */
export function compareCensus(censusRows, billRows, { start, end, rates = [], bedHoldPayers = [], rateTolerance = 0.01 } = {}) {
  const census = censusDays(censusRows, start, end);
  const billed = billedDays(billRows, start, end);
  const paysHold = (d) => bedHoldPayers.some((p) => p === d.payer_type || payerKey(p) === payerKey(d.payer));
  const cIdx = new Map(); for (const d of census) { const k = `${d.resident_id}|${d.date}`; if (!cIdx.has(k)) cIdx.set(k, []); cIdx.get(k).push(d); }
  const bIdx = new Map(); for (const d of billed) { const k = `${d.resident_id}|${d.date}`; if (!bIdx.has(k)) bIdx.set(k, []); bIdx.get(k).push(d); }
  const lastDay = new Map(); for (const d of census) if (!lastDay.has(d.resident_id) || d.date > lastDay.get(d.resident_id)) lastDay.set(d.resident_id, d.date);
  const names = new Map(); for (const d of [...census, ...billed]) if (d.resident_name && !names.has(d.resident_id)) names.set(d.resident_id, d.resident_name);
  const rate = (d) => rateFor(rates, { payer: d.payer, payer_type: d.payer_type, level: d.level, date: d.date });
  const finds = [];
  const keys = new Set([...cIdx.keys(), ...bIdx.keys()]);
  let billable = 0;
  for (const k of keys) {
    const cs = cIdx.get(k) || []; const bs = bIdx.get(k) || [];
    if (cs.length > 1 && new Set(cs.map((c) => payerKey(c.payer))).size > 1) finds.push({ ...cs[0], status: 'census_overlap', billed_payer: null, amount: 0, other: cs.slice(1).map((c) => c.payer).join(', ') });
    const c = cs[0];
    const holdDay = c && c.bed_status !== 'in_house';
    const isBillable = c && (!holdDay || paysHold(c));
    if (isBillable) billable++;
    if (bs.length > 1) finds.push({ ...bs[1], status: 'duplicate_billed', billed_payer: [...new Set(bs.map((b) => b.payer))].join(', '), amount: rate(bs[1]) || 0 });
    const b = bs[0];
    if (!c && b) { finds.push({ ...b, status: 'billed_not_in_census', billed_payer: b.payer, amount: rate(b) || 0, after_discharge: lastDay.has(b.resident_id) && b.date > lastDay.get(b.resident_id) }); continue; }
    if (!c) continue;
    if (holdDay && b && !paysHold(c)) { finds.push({ ...c, status: 'bed_hold_billed', billed_payer: b.payer, amount: rate(b) || 0 }); continue; }
    if (isBillable && !b) { finds.push({ ...c, status: 'unbilled', billed_payer: null, amount: rate(c) || 0 }); continue; }
    if (b && payerKey(b.payer) !== payerKey(c.payer)) { finds.push({ ...c, status: 'wrong_payer', billed_payer: b.payer, amount: rate(c) || 0 }); continue; }
    if (b && c.level && b.level && str(b.level).toUpperCase() !== str(c.level).toUpperCase()) finds.push({ ...c, status: 'level_mismatch', billed_payer: b.payer, billed_level: b.level, amount: round2(Math.abs((rate(c) || 0) - (rate({ ...c, level: b.level }) || 0))) });
  }
  // Group days into runs per resident, status and payer pair.
  const runs = dayRuns(finds, (f) => `${f.resident_id}|${f.status}|${f.payer || ''}|${f.billed_payer || ''}|${f.billed_level || ''}`);
  const items = runs.map((r) => {
    const f = r.first; const amount = round2(r.items.reduce((s, x) => s + (x.amount || 0), 0));
    const span = r.from === r.to ? r.from : `${r.from} to ${r.to}`;
    const it = { status: f.status, resident_id: f.resident_id, resident_name: names.get(f.resident_id) || null, from: r.from, to: r.to, days: r.days, payer: f.payer, billed_payer: f.billed_payer || null, level: f.level || null, amount };
    const T = {
      unbilled: [`${r.days} census day(s) with ${f.payer} (${span}) were not billed.`, 'Bill the days, or correct the census if the resident was not in the building.'],
      wrong_payer: [`The census has ${f.payer} for ${span}; the days were billed to ${f.billed_payer}.`, 'Fix the payer on the census or rebill the right payer before the claim is denied or recouped.'],
      billed_not_in_census: [`${r.days} day(s) billed to ${f.payer} (${span}) are not on the census${f.after_discharge ? ', after the resident\'s last census day' : ''}.`, 'Cancel or correct the billed days, or add the missing census rows if the resident was there.'],
      bed_hold_billed: [`${r.days} leave or hospital day(s) (${span}) were billed to ${f.billed_payer}, which is not on your bed-hold payer list.`, 'Check the payer\'s bed-hold rule; if it does not pay leave days, take them off the claim.'],
      duplicate_billed: [`${span} was billed more than once (${f.billed_payer}).`, 'Void the duplicate line.'],
      census_overlap: [`Two census rows cover ${span}: ${f.payer} and ${f.other}.`, 'End one row the day the other starts so each day has one payer.'],
      level_mismatch: [`The census level is ${f.level} for ${span}; the claim has ${f.billed_level}.`, 'Bill the level on the census (or correct the census level).'],
    }[f.status];
    it.message = T[0]; it.fix = T[1];
    return it;
  });
  // Rate check per billed line (amount / days against the rate table).
  for (const [i, r] of billRows.entries()) {
    const amt = num(r.amount); const from = isoDate(r.from); if (amt === null || !from) continue;
    const days = num(r.days) ?? dateRange(from, isoDate(r.to) || from).length;
    if (!days) continue;
    const exp = rateFor(rates, { payer: r.payer, payer_type: payerType(r.payer, r.payer_type), level: r.level, date: from });
    if (exp === null) continue;
    const got = round2(amt / days);
    if (Math.abs(got - exp) > rateTolerance) items.push({ status: 'rate_mismatch', resident_id: str(r.resident_id) || str(r.resident_name), resident_name: str(r.resident_name) || null, from, to: isoDate(r.to) || from, days, payer: str(r.payer), billed_payer: str(r.payer), level: str(r.level) || null, amount: round2(Math.abs(exp - got) * days), line: i + 1, message: `Billed ${got} a day; the rate table has ${exp} for ${str(r.payer)}${r.level ? ` level ${str(r.level)}` : ''}.`, fix: 'Correct the rate on the claim, or update the rate table if the contract changed.' });
  }
  sortByStatus(items, ORDER);
  const at_risk = total(items.filter((i) => ['unbilled', 'wrong_payer', 'level_mismatch', 'rate_mismatch'].includes(i.status)), 'amount');
  const over = total(items.filter((i) => ['billed_not_in_census', 'bed_hold_billed', 'duplicate_billed'].includes(i.status)), 'amount');
  return {
    period: { start, end }, residents: new Set(census.map((d) => d.resident_id)).size, census_days: census.length, billable_days: billable, billed_days: billed.length,
    revenue_at_risk: at_risk, overbilled: over, by_status: countBy(items, 'status'), items,
  };
}

export const periodOf = (a) => { if (a.month) { const b = monthBounds(a.month); if (!b) throw new Error('month must be YYYY-MM'); return b; } if (a.start && a.end) return { start: a.start, end: a.end }; throw new Error('give month (YYYY-MM) or start and end'); };
