// Fairstay Part B Therapy logic: Medicare Part B therapy lines for nursing-home residents. No I/O.
import { str, num, isoDate, round2, censusDays, sortByStatus, countBy, total, idKey, listOf } from 'fairstay-core';

const ORDER = { part_a_overlap: 0, units_over_8_minute_rule: 1, duplicate_line: 2, missing_discipline_modifier: 3, kx_needed: 4 };
// Common timed (15-minute) therapy codes. Replace with your own list in the rules file.
export const DEFAULT_TIMED = Object.freeze(['97110', '97112', '97113', '97116', '97140', '97530', '97535', '97542', '97750', '97760', '97761', '97763', '97032', '97033', '97035', '97129', '97130']);

/** Units allowed by the 8-minute rule for total timed minutes in a day. */
export const unitsFor8MinuteRule = (minutes) => { const m = Math.max(0, Math.floor(num(minutes) || 0)); return Math.floor(m / 15) + (m % 15 >= 8 ? 1 : 0); };

const DISC = { GP: 'pt', GO: 'ot', GN: 'slp' };

/** lines: [{resident_id, date, cpt, modifiers, minutes, units, charge, allowed}] ; opts: { census, timed, kxThresholds: { pt_slp, ot }, year } */
export function checkPartB(lines, { census = null, timed = DEFAULT_TIMED, kxThresholds = null } = {}) {
  const items = [];
  const timedSet = new Set(timed.map((c) => str(c).toUpperCase()));
  const L = lines.map((l, i) => ({ resident_id: str(l.resident_id) || str(l.resident_name), resident_name: str(l.resident_name) || null, date: isoDate(l.date), cpt: str(l.cpt).toUpperCase(), mods: listOf(str(l.modifiers).replace(/\s+/g, ',')).map((m) => m.toUpperCase()), minutes: num(l.minutes), units: num(l.units) || 1, charge: num(l.charge) || 0, allowed: num(l.allowed) ?? num(l.charge) ?? 0, line: i + 1 }));
  const add = (l, status, amount, message, fix, extra = {}) => items.push({ status, resident_id: l.resident_id, resident_name: l.resident_name, date: l.date, cpt: l.cpt, units: l.units, amount: round2(amount), line: l.line, ...extra, message, fix });
  const lastDate = L.map((l) => l.date).filter(Boolean).sort().at(-1);
  const partA = census ? new Set(censusDays(census, undefined, lastDate).filter((d) => d.payer_type === 'medicare_a').map((d) => `${idKey(d.resident_id)}|${d.date}`)) : new Set();
  const seen = new Map();
  for (const l of L) {
    if (partA.has(`${idKey(l.resident_id)}|${l.date}`)) add(l, 'part_a_overlap', l.charge, `${l.cpt} on ${l.date} was billed to Part B while the resident was in a Medicare Part A stay.`, 'Therapy during a Part A stay is the home\'s responsibility under consolidated billing; take the line off the Part B claim.');
    const disc = l.mods.find((m) => DISC[m]);
    if (!disc) add(l, 'missing_discipline_modifier', 0, `${l.cpt} on ${l.date} has no GP, GO or GN modifier.`, 'Add the modifier for the discipline that gave the service (GP physical, GO occupational, GN speech).');
    const k = `${idKey(l.resident_id)}|${l.date}|${l.cpt}|${l.mods.slice().sort().join(',')}`;
    if (seen.has(k)) add(l, 'duplicate_line', l.charge, `${l.cpt} on ${l.date} appears twice with the same modifiers.`, 'Void the duplicate, or combine the units on one line.');
    else seen.set(k, l);
  }
  // 8-minute rule per resident per day across all timed codes.
  const days = new Map();
  for (const l of L.filter((x) => timedSet.has(x.cpt))) { const k = `${idKey(l.resident_id)}|${l.date}`; if (!days.has(k)) days.set(k, []); days.get(k).push(l); }
  for (const ls of days.values()) {
    if (ls.some((l) => l.minutes === null)) continue;
    const minutes = ls.reduce((s, l) => s + l.minutes, 0); const allowed = unitsFor8MinuteRule(minutes); const billed = ls.reduce((s, l) => s + l.units, 0);
    if (billed > allowed) { const perUnit = ls.reduce((s, l) => s + l.charge, 0) / billed; add(ls[0], 'units_over_8_minute_rule', perUnit * (billed - allowed), `${billed} timed unit(s) billed on ${ls[0].date} for ${minutes} total timed minutes; the 8-minute rule allows ${allowed}.`, 'Bill the units the minutes support, or document the missing minutes.', { minutes, units_allowed: allowed, units: billed }); }
  }
  // KX threshold per resident per calendar year: PT and SLP together, OT on its own.
  if (kxThresholds) {
    const sums = new Map();
    for (const l of L.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
      const d = DISC[l.mods.find((m) => DISC[m])]; if (!d) continue;
      const group = d === 'ot' ? 'ot' : 'pt_slp'; const limit = kxThresholds[group]; if (!limit) continue;
      const k = `${idKey(l.resident_id)}|${String(l.date).slice(0, 4)}|${group}`; const before = sums.get(k) || 0; const after = before + l.allowed; sums.set(k, after);
      if (after > limit && !l.mods.includes('KX')) add(l, 'kx_needed', l.allowed, `${group === 'ot' ? 'OT' : 'PT and speech'} spending reaches ${round2(after)} this year, over the ${limit} threshold, and the line has no KX modifier.`, 'Add KX if the therapy is medically necessary and documented; without it the line is denied.', { year_to_date: round2(after) });
    }
  }
  sortByStatus(items, ORDER);
  return { lines: L.length, residents: new Set(L.map((l) => idKey(l.resident_id))).size, charges_at_risk: total(items.filter((i) => ['part_a_overlap', 'units_over_8_minute_rule', 'duplicate_line'].includes(i.status)), 'amount'), by_status: countBy(items, 'status'), items };
}
