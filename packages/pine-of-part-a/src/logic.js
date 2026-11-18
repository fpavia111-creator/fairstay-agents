// Pine logic: Medicare Part A SNF claim lines (UB-04 / 837I) against PDPM shape rules and the census. No I/O.
import { str, num, isoDate, daysBetween, round2, censusDays, monthOf, sortByStatus, countBy, total, idKey } from 'evergreen-core';

const ORDER = { no_hipps_line: 0, hipps_missing: 1, hipps_invalid: 2, days_mismatch: 3, coinsurance_mismatch: 4, qualifying_stay_missing: 5, qualifying_stay_short: 6, default_hipps: 7, crosses_month: 8, future_through: 9 };

/** PDPM HIPPS shape: PT/OT A-P, SLP A-L, nursing A-Y, NTA A-F, then an assessment indicator digit. ZZZZZ is the default code. */
export function hippsProblem(code) {
  const c = str(code).toUpperCase();
  if (!c) return 'missing';
  if (c === 'ZZZZZ') return 'default';
  if (!/^[A-P][A-L][A-Y][A-F][0-9]$/.test(c)) return 'invalid';
  return null;
}

/** Group claim lines into claims. */
export function groupLines(rows) {
  const m = new Map();
  rows.forEach((r, i) => {
    const id = str(r.claim_id) || `row-${i + 1}`;
    if (!m.has(id)) m.set(id, { claim_id: id, resident_id: str(r.resident_id) || str(r.resident_name), resident_name: str(r.resident_name) || null, from: isoDate(r.from), through: isoDate(r.through), qs_from: isoDate(r.qs_from), qs_to: isoDate(r.qs_to), coinsurance_days: num(r.coinsurance_days), lines: [] });
    const c = m.get(id);
    for (const k of ['from', 'through', 'qs_from', 'qs_to']) if (!c[k] && isoDate(r[k])) c[k] = isoDate(r[k]);
    if (c.coinsurance_days === null && num(r.coinsurance_days) !== null) c.coinsurance_days = num(r.coinsurance_days);
    c.lines.push({ revenue_code: str(r.revenue_code).padStart(4, '0'), hipps: str(r.hipps).toUpperCase(), units: num(r.units) || 0, charges: num(r.charges) || 0 });
  });
  return [...m.values()];
}

/**
 * opts: { census (rows, optional), priorDays: Map(residentKey -> Part A days used earlier in the benefit period), asOf }
 */
export function checkPartA(rows, { census = null, priorDays = new Map(), asOf } = {}) {
  const claims = groupLines(rows);
  const cdays = census ? censusDays(census, undefined, asOf).filter((d) => d.payer_type === 'medicare_a') : null;
  const items = [];
  for (const c of claims) {
    const charges = round2(c.lines.reduce((s, l) => s + l.charges, 0));
    const add = (status, message, fix, extra = {}) => items.push({ status, claim_id: c.claim_id, resident_id: c.resident_id, resident_name: c.resident_name, from: c.from, through: c.through, amount: charges, ...extra, message, fix });
    const pps = c.lines.filter((l) => l.revenue_code === '0022');
    if (!pps.length) add('no_hipps_line', 'No revenue code 0022 line: a Part A SNF claim carries its PDPM days on 0022 lines with a HIPPS code.', 'Rebuild the claim from the assessment so each payment period has a 0022 line.');
    for (const l of pps) {
      const p = hippsProblem(l.hipps);
      if (p === 'missing') add('hipps_missing', 'A 0022 line has no HIPPS code.', 'Add the HIPPS code from the PDPM assessment (MDS) for that period.');
      else if (p === 'invalid') add('hipps_invalid', `HIPPS "${l.hipps}" does not have the PDPM shape (PT/OT A-P, SLP A-L, nursing A-Y, NTA A-F, then a digit).`, 'Check the code against the MDS assessment; a typo here changes the payment.', { hipps: l.hipps });
      else if (p === 'default') add('default_hipps', `${l.units} day(s) billed at the default code ZZZZZ (paid at the lowest rate).`, 'Default days usually mean a late or missing assessment; check whether the MDS can still be completed and the days rebilled.', { hipps: l.hipps, days: l.units });
    }
    const units = pps.reduce((s, l) => s + l.units, 0);
    if (c.from && c.through && monthOf(c.from) !== monthOf(c.through)) add('crosses_month', `The claim runs ${c.from} to ${c.through}, across a month end.`, 'Bill Part A SNF claims by calendar month (one claim per month).');
    if (c.through && asOf && c.through > asOf) add('future_through', `Through date ${c.through} is after ${asOf}.`, 'Do not bill days that have not happened; hold the claim until the month closes.');
    if (cdays && c.from && c.through) {
      const rk = idKey(c.resident_id);
      const mine = cdays.filter((d) => idKey(d.resident_id) === rk);
      const inClaim = new Set(mine.filter((d) => d.date >= c.from && d.date <= c.through).map((d) => d.date));
      // A discharge through date is not a covered day; the census already leaves it out.
      if (inClaim.size !== units) add('days_mismatch', `0022 lines carry ${units} day(s); the census has ${inClaim.size} Medicare Part A day(s) from ${c.from} to ${c.through}.`, 'Make the covered days match the census (or fix the census first).', { claim_days: units, census_days: inClaim.size });
      const before = new Set(mine.filter((d) => d.date < c.from).map((d) => d.date)).size + (priorDays.get(rk) || 0);
      const days = [...inClaim].sort();
      const coins = days.filter((_, i) => before + i + 1 >= 21 && before + i + 1 <= 100).length;
      if (c.coinsurance_days !== null && c.coinsurance_days !== coins) add('coinsurance_mismatch', `Claim reports ${c.coinsurance_days} coinsurance day(s); by the census this claim covers benefit days ${before + 1} to ${before + days.length}, which have ${coins} coinsurance day(s) (days 21-100).`, 'Correct the coinsurance days (value code 09/occurrence) so the remittance and crossover are right.', { expected_coinsurance_days: coins });
    }
    if (!c.qs_from || !c.qs_to) add('qualifying_stay_missing', 'No qualifying hospital stay dates (occurrence span 70) on the claim.', 'Add occurrence span code 70 with the inpatient admission and discharge dates.');
    else { const ip = daysBetween(c.qs_from, c.qs_to); if (ip < 3) add('qualifying_stay_short', `The qualifying stay ${c.qs_from} to ${c.qs_to} is ${ip} inpatient day(s); at least 3 are needed (discharge day not counted).`, 'Check the hospital record (observation days do not count) or the waiver that applies.', { inpatient_days: ip }); }
  }
  sortByStatus(items, ORDER);
  return { claims: claims.length, claims_with_findings: new Set(items.map((i) => i.claim_id)).size, charges_on_flagged_claims: total([...new Map(items.map((i) => [i.claim_id, i])).values()], 'amount'), by_status: countBy(items, 'status'), items };
}
