// Nursing-home (skilled nursing facility) helpers shared by the Fairstay agents. Pure: no I/O.
//
// Census convention used everywhere (the usual midnight census):
//   a census row is one stretch of a stay with one payer, level and bed status, from `from`
//   up to `to`. The `to` day itself is NOT counted (it is the discharge day, or the day the
//   next row starts). A row whose from and to are the same day counts one day (admitted and
//   discharged the same day). A blank `to` means the stay is still going on.
import { str, num, isoDate, addDays, daysBetween, payerKey, round2 } from 'fairclaim-core';

export const PAYER_TYPES = Object.freeze(['medicare_a', 'medicare_b', 'medicaid', 'medicaid_pending', 'managed_care', 'hospice', 'private', 'insurance', 'va', 'unknown']);

/**
 * Payer type from the words a billing system uses. An explicit type column wins; otherwise the
 * payer name is read. "Medicare Advantage", "HMO" and "MA plan" are managed care, never Medicare A.
 */
export function payerType(name, explicit) {
  const e = str(explicit).toLowerCase().replace(/[\s-]+/g, '_');
  if (PAYER_TYPES.includes(e)) return e;
  const alias = { mcr_a: 'medicare_a', part_a: 'medicare_a', medicare: 'medicare_a', mcr_b: 'medicare_b', part_b: 'medicare_b', mcd: 'medicaid', medicaid_pend: 'medicaid_pending', pending: 'medicaid_pending', hmo: 'managed_care', mco: 'managed_care', ma: 'managed_care', private_pay: 'private', self_pay: 'private', commercial: 'insurance' };
  if (alias[e]) return alias[e];
  const s = str(name).toLowerCase();
  if (!s) return 'unknown';
  if (/hospice/.test(s)) return 'hospice';
  if (/medicaid|mcd\b|medi-cal|ahcccs|masshealth|tenncare/.test(s) && /pend/.test(s)) return 'medicaid_pending';
  if (/advantage|hmo|ppo|\bmco\b|managed|\bma\b|humana|aetna|united ?health|uhc|wellcare|cigna|anthem|molina|centene|superior|amerigroup|star ?plus|snp\b/.test(s)) return 'managed_care';
  if (/medicare|\bmcr\b/.test(s)) return /part ?b\b|\bmcr ?b\b|medicare ?b\b/.test(s) ? 'medicare_b' : 'medicare_a';
  if (/medicaid|\bmcd\b|medi-cal/.test(s)) return 'medicaid';
  if (/\bva\b|veteran/.test(s)) return 'va';
  if (/private|self|family|resident pay|cash/.test(s)) return 'private';
  if (/insur|commercial|blue|bcbs|ltc ?policy|long[- ]term care ins/.test(s)) return 'insurance';
  return 'unknown';
}

/** Bed status in everyday words: in_house, leave (therapeutic / home leave), hospital (hospital leave / bed hold), discharged. */
export function bedStatus(v) {
  const s = str(v).toLowerCase();
  if (!s || /in ?house|present|active|occupied|admit/.test(s)) return 'in_house';
  if (/hosp|bed ?hold|\bhl\b|\bbh\b/.test(s)) return 'hospital';
  if (/leave|\bloa\b|therap|home visit|\bthl\b/.test(s)) return 'leave';
  if (/disch|expired|death|deceased|\bdc\b/.test(s)) return 'discharged';
  return 'in_house';
}

/** Days a census row covers inside [start, end] inclusive (end defaults to the row's own end). */
export function rowDays(row, start, end) {
  const from = isoDate(row.from); if (!from) return [];
  const to = isoDate(row.to);
  let last = to ? (to === from ? from : addDays(to, -1)) : (end || from);
  if (end && last > end) last = end;
  let first = start && from < start ? start : from;
  const out = [];
  for (let d = first; d && d <= last; d = addDays(d, 1)) { out.push(d); if (out.length > 3700) break; }
  return out;
}

/**
 * Expand census rows into one record per resident per day in [start, end] (inclusive).
 * Each day: { resident_id, resident_name, date, payer, payer_type, level, bed_status, row }.
 * Two rows for the same resident on the same day are both kept (an overlap is a finding).
 */
export function censusDays(rows, start, end) {
  const out = [];
  rows.forEach((r, i) => {
    for (const date of rowDays(r, start, end)) out.push({ resident_id: str(r.resident_id) || str(r.resident_name), resident_name: str(r.resident_name) || null, date, payer: str(r.payer) || null, payer_type: payerType(r.payer, r.payer_type), level: str(r.level) || null, bed_status: bedStatus(r.bed_status), room: str(r.room) || null, facility: str(r.facility) || null, row: i + 1 });
  });
  return out;
}

/** Map resident id -> date -> [day records]. */
export function dayIndex(days) {
  const m = new Map();
  for (const d of days) { if (!m.has(d.resident_id)) m.set(d.resident_id, new Map()); const r = m.get(d.resident_id); if (!r.has(d.date)) r.set(d.date, []); r.get(d.date).push(d); }
  return m;
}

/** First and last day of a month 'YYYY-MM'. */
export function monthBounds(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(str(month)); if (!m) return null;
  const start = `${m[1]}-${m[2]}-01`;
  const last = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).toISOString().slice(0, 10);
  return { start, end: last, days: Number(last.slice(8)) };
}
export const monthOf = (d) => (isoDate(d) || '').slice(0, 7);

/** Per-diem rate for payer (or payer type) + level on a date from a rate table [{ payer?, payer_type?, level?, rate, from?, to? }]. Most specific wins. */
export function rateFor(rates, { payer, payer_type, level, date }) {
  const pk = payer ? payerKey(payer) : null; const lv = str(level).toUpperCase();
  let best = null; let score = -1;
  for (const r of rates || []) {
    if (r.payer && payerKey(r.payer) !== pk) continue;
    if (r.payer_type && r.payer_type !== payer_type) continue;
    if (r.level && str(r.level).toUpperCase() !== lv) continue;
    if (date && r.from && isoDate(r.from) > date) continue;
    if (date && r.to && isoDate(r.to) < date) continue;
    const s = (r.payer ? 4 : 0) + (r.level ? 2 : 0) + (r.payer_type ? 1 : 0);
    if (s > score) { best = r; score = s; }
  }
  return best ? num(best.rate) : null;
}

/** Days old between two dates, and a bucket label. */
export function ageDays(from, asOf) { const d = daysBetween(from, asOf); return d === null ? null : d; }
export const AGING_EDGES = Object.freeze([30, 60, 90, 120, 180, 365]);
export function agingBucket(days, edges = AGING_EDGES) {
  if (days === null || days === undefined) return 'unknown';
  if (days < 0) return 'future';
  let lo = 0; for (const e of edges) { if (days <= e) return `${lo}-${e}`; lo = e + 1; }
  return `${edges.at(-1)}+`;
}

/** Sum a field over items, rounded to cents. */
export const total = (items, f) => round2(items.reduce((s, x) => s + (Number(typeof f === 'function' ? f(x) : x[f]) || 0), 0));

/** Count of items by a key, as { key: n }. */
export function countBy(items, key) { const m = {}; for (const x of items) { const k = typeof key === 'function' ? key(x) : x[key]; if (k === undefined || k === null) continue; m[k] = (m[k] || 0) + 1; } return m; }

/** Sort items by an order map for `status`, then by a secondary key (descending amount by default). */
export function sortByStatus(items, order, amountKey = 'amount') {
  const o = (s) => (order[s] ?? 99);
  return items.sort((a, b) => o(a.status) - o(b.status) || (Number(b[amountKey]) || 0) - (Number(a[amountKey]) || 0) || String(a.resident_id ?? a.id ?? '').localeCompare(String(b.resident_id ?? b.id ?? '')));
}

/** Normalised identifier for matching (invoice numbers, auth numbers): letters and digits, upper case, leading zeros dropped. */
export const idKey = (v) => str(v).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+(?=\d)/, '');

/** Yes/no in everyday words. */
export const yes = (v) => /^(y|yes|true|1|x|✓|done|complete|completed)$/i.test(str(v));

/** A list from a cell: "a; b, c" -> ['a','b','c']. */
export const listOf = (v) => (Array.isArray(v) ? v : str(v).split(/[;,|]+/)).map((x) => str(x)).filter(Boolean);

/**
 * Group day-level findings into runs of consecutive days with the same key.
 * days: [{ date, ...}] ; key(d) -> string. Returns [{ key, first, from, to (inclusive), days, items }].
 */
export function dayRuns(days, key) {
  // Keys computed once per day, not twice per comparison while sorting.
  const sorted = days.map((d) => [key(d), d]).sort((a, b) => a[0].localeCompare(b[0]) || a[1].date.localeCompare(b[1].date));
  const runs = [];
  for (const [k, d] of sorted) {
    const last = runs.at(-1);
    if (last && last.key === k && addDays(last.to, 1) === d.date) { last.to = d.date; last.days++; last.items.push(d); }
    else if (last && last.key === k && last.to === d.date) { last.items.push(d); }
    else runs.push({ key: k, first: d, from: d.date, to: d.date, days: 1, items: [d] });
  }
  return runs;
}

/** Inclusive date list from..to (both included). */
export function dateRange(from, to, max = 3700) {
  const a = isoDate(from), b = isoDate(to) || a; const out = [];
  for (let d = a; d && d <= b && out.length < max; d = addDays(d, 1)) out.push(d);
  return out;
}
