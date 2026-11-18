// Cedar logic: every resident day has one proper payer. No I/O.
import { str, num, payerKey, round2, censusDays, dayRuns, sortByStatus, countBy, total, idKey } from 'evergreen-core';

const ORDER = { no_payer: 0, payer_overlap: 1, part_a_over_100: 2, unknown_payer: 3, hospice_on_part_a: 4, coinsurance_no_secondary: 5, private_no_guarantor: 6 };

/**
 * opts: { start, end, payers: [{ name, type? }] | null, residents: [{ resident_id, secondary_payer, responsible_party, hospice_agency, part_a_days_used }], coinsuranceRate }
 */
export function checkPayerSource(censusRows, { start, end, payers = null, residents = [], coinsuranceRate = null } = {}) {
  const all = censusDays(censusRows, undefined, end);
  const known = payers ? new Set(payers.map((p) => payerKey(p.name))) : null;
  const res = new Map(residents.map((r) => [idKey(r.resident_id || r.resident_name), r]));
  // Part A day number per resident: count Part A days in date order (prior days from the residents file first).
  const partA = new Map();
  for (const d of all.filter((x) => x.payer_type === 'medicare_a').sort((a, b) => a.date.localeCompare(b.date))) {
    const k = idKey(d.resident_id); const seen = partA.get(k) || { n: num((res.get(k) || {}).part_a_days_used) || 0, dates: new Set() };
    if (!seen.dates.has(d.date)) { seen.n++; seen.dates.add(d.date); d.part_a_day = seen.n; }
    partA.set(k, seen);
  }
  const days = all.filter((d) => d.date >= start && d.date <= end);
  const byDay = new Map(); for (const d of days) { const k = `${idKey(d.resident_id)}|${d.date}`; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(d); }
  const finds = [];
  for (const ds of byDay.values()) {
    const payersToday = [...new Set(ds.filter((d) => d.payer).map((d) => payerKey(d.payer)))];
    if (payersToday.length > 1) finds.push({ ...ds[0], status: 'payer_overlap', other: ds.slice(1).map((d) => d.payer).join(', ') });
    for (const d of ds.slice(0, 1)) {
      const r = res.get(idKey(d.resident_id)) || {};
      if (!d.payer) { finds.push({ ...d, status: 'no_payer' }); continue; }
      if (known && !known.has(payerKey(d.payer))) finds.push({ ...d, status: 'unknown_payer' });
      if (d.payer_type === 'medicare_a' && d.part_a_day > 100) finds.push({ ...d, status: 'part_a_over_100' });
      if (d.payer_type === 'medicare_a' && d.part_a_day >= 21 && d.part_a_day <= 100 && !str(r.secondary_payer)) finds.push({ ...d, status: 'coinsurance_no_secondary', amount: coinsuranceRate || 0 });
      if (d.payer_type === 'medicare_a' && str(r.hospice_agency)) finds.push({ ...d, status: 'hospice_on_part_a', hospice: str(r.hospice_agency) });
      if (d.payer_type === 'private' && !str(r.responsible_party)) finds.push({ ...d, status: 'private_no_guarantor' });
    }
  }
  const runs = dayRuns(finds, (f) => `${idKey(f.resident_id)}|${f.status}|${payerKey(f.payer)}`);
  const items = runs.map((r) => {
    const f = r.first; const span = r.from === r.to ? r.from : `${r.from} to ${r.to}`;
    const firstDay = r.items[0].part_a_day; const lastDay = r.items.at(-1).part_a_day;
    const T = {
      no_payer: [`No payer on the census for ${span}.`, 'Set the payer for these days; nobody can be billed until it is set.'],
      payer_overlap: [`Two payers on the census for ${span}: ${f.payer} and ${f.other}.`, 'End one payer the day the other starts.'],
      unknown_payer: [`"${f.payer}" (${span}) is not on your payer list.`, 'Fix the spelling or add the payer (with its type and billing rules) to the payer list.'],
      part_a_over_100: [`Medicare Part A ${lastDay !== firstDay ? `days ${firstDay} to ${lastDay}` : `day ${firstDay}`} (${span}); Part A covers at most 100 days per benefit period.`, 'Move these days to the next payer and give the required notices.'],
      coinsurance_no_secondary: [`${lastDay !== firstDay ? `Part A days ${firstDay} to ${lastDay}` : `Part A day ${firstDay}`} (${span}) ${lastDay !== firstDay ? 'carry' : 'carries'} daily coinsurance, and no secondary payer is on file.`, 'Record the secondary payer (Medicaid crossover, supplemental plan) or bill the resident for the coinsurance.'],
      hospice_on_part_a: [`The resident has a hospice agency (${f.hospice}) and is on Medicare Part A for ${span}.`, 'Part A SNF and hospice for the same terminal illness do not run together; confirm the skilled stay is for an unrelated condition, or fix the payer.'],
      private_no_guarantor: [`Private pay for ${span} with no responsible party on file.`, 'Record who pays (resident, family, POA) and their billing address.'],
    }[f.status];
    return { status: f.status, resident_id: f.resident_id, resident_name: f.resident_name, payer: f.payer, from: r.from, to: r.to, days: r.days, amount: round2(r.items.reduce((s, x) => s + (x.amount || 0), 0)), message: T[0], fix: T[1] };
  });
  sortByStatus(items, ORDER);
  return { period: { start, end }, residents: new Set(days.map((d) => idKey(d.resident_id))).size, resident_days: byDay.size, days_with_findings: new Set(finds.map((f) => `${idKey(f.resident_id)}|${f.date}`)).size, coinsurance_at_risk: total(items.filter((i) => i.status === 'coinsurance_no_secondary'), 'amount'), by_status: countBy(items, 'status'), items };
}
