// Birch logic: eligibility for residents in the building on a date. No I/O.
import { str, num, isoDate, daysBetween, payerType, censusDays, sortByStatus, countBy, yes, idKey } from 'evergreen-core';

const ORDER = { coverage_ended: 0, inactive: 1, benefit_exhausted: 2, no_qualifying_stay: 3, short_qualifying_stay: 4, late_admission: 5, no_check: 6, stale_check: 7, renewal_overdue: 8, benefit_ending: 9, coverage_ending: 10, renewal_due: 11 };

/** Eligibility status words: active unless the words say otherwise; unknown words are not taken as active. */
export function eligStatus(v) {
  const s = str(v).toLowerCase();
  if (!s) return 'unknown';
  if (/inactive|terminat|not (active|eligible)|ineligible|denied|ended|no coverage|lapsed/.test(s)) return 'inactive';
  if (/active|eligible|covered|in force|yes/.test(s)) return 'active';
  return 'unknown';
}

/** Inpatient days for the qualifying stay: admission to discharge, discharge day not counted. */
export const inpatientDays = (admit, discharge) => { const d = daysBetween(admit, discharge); return d === null ? null : d; };

/**
 * Check every resident in the building on asOf.
 * opts: { asOf, staleDays=30, warnDays=14, renewalWarnDays=60, benefitDays=100 }
 */
export function checkEligibility(censusRows, eligRows, stayRows = [], opts = {}) {
  const { asOf, staleDays = 30, warnDays = 14, renewalWarnDays = 60, benefitDays = 100 } = opts;
  const today = censusDays(censusRows, asOf, asOf);
  const hist = censusDays(censusRows, undefined, asOf);
  const elig = new Map(); for (const e of eligRows) { const k = `${idKey(e.resident_id || e.resident_name)}|${payerType(e.payer, e.payer_type)}`; const prev = elig.get(k); if (!prev || (isoDate(e.checked_on) || '') > (isoDate(prev.checked_on) || '')) elig.set(k, e); }
  const stays = new Map(); for (const s of stayRows) { const k = idKey(s.resident_id || s.resident_name); const prev = stays.get(k); if (!prev || (isoDate(s.snf_admit) || '') > (isoDate(prev.snf_admit) || '')) stays.set(k, s); }
  const items = []; const seen = new Set();
  for (const d of today) {
    const rk = idKey(d.resident_id); if (seen.has(`${rk}|${d.payer_type}`)) continue; seen.add(`${rk}|${d.payer_type}`);
    const base = { resident_id: d.resident_id, resident_name: d.resident_name, payer: d.payer, payer_type: d.payer_type };
    const add = (status, message, fix, extra = {}) => items.push({ status, ...base, ...extra, message, fix });
    if (['private', 'unknown'].includes(d.payer_type)) continue;
    const e = elig.get(`${rk}|${d.payer_type}`);
    if (!e) add('no_check', `No eligibility check on file for ${d.payer}.`, 'Run an eligibility check (270/271 or the payer portal) and keep the response.');
    else {
      const checked = isoDate(e.checked_on); const age = checked ? daysBetween(checked, asOf) : null;
      const st = eligStatus(e.status); const to = isoDate(e.coverage_to);
      if (st === 'inactive') add('inactive', `The last check (${checked || 'no date'}) says ${d.payer} coverage is not active.`, 'Confirm with the payer today; if it ended, move the resident to the right payer and plan the next payer.', { checked_on: checked });
      else if (to && to < asOf) add('coverage_ended', `${d.payer} coverage ended ${to}, but the census still has this payer.`, 'Change the census payer from the day after coverage ended, and start the next payer\'s paperwork.', { coverage_to: to });
      else {
        if (age === null || age > staleDays) add('stale_check', `Last eligibility check ${checked ? `${age} days ago (${checked})` : 'has no date'}; the limit is ${staleDays} days.`, 'Re-check eligibility; coverage changes month to month for Medicaid and managed care.', { checked_on: checked, days_since_check: age });
        if (to && daysBetween(asOf, to) <= warnDays) add('coverage_ending', `${d.payer} coverage ends ${to} (${daysBetween(asOf, to)} days).`, 'Ask the resident or family about renewal, or line up the next payer now.', { coverage_to: to, days_left: daysBetween(asOf, to) });
      }
      const ren = isoDate(e.renewal_date);
      if (ren && d.payer_type === 'medicaid') {
        const left = daysBetween(asOf, ren);
        if (left < 0) add('renewal_overdue', `Medicaid renewal date ${ren} has passed.`, 'Check the renewal was filed and coverage continues; file it now if not.', { renewal_date: ren, days_left: left });
        else if (left <= renewalWarnDays) add('renewal_due', `Medicaid renewal due ${ren} (${left} days).`, 'Gather the renewal documents with the family now.', { renewal_date: ren, days_left: left });
      }
    }
    if (d.payer_type === 'medicare_a') {
      // Days used: earlier days in the benefit period (from the eligibility check) plus Part A days in this stay so far.
      const stayDays = hist.filter((x) => idKey(x.resident_id) === rk && x.payer_type === 'medicare_a').length;
      const prior = e ? num(e.part_a_days_used) || 0 : 0;
      const left = benefitDays - prior - stayDays;
      if (left <= 0) add('benefit_exhausted', `Medicare Part A days are used up (${prior} earlier + ${stayDays} this stay).`, 'Stop billing Part A for days past 100; move to the next payer and give the required notices.', { days_used: prior + stayDays, days_left: left });
      else if (left <= warnDays) add('benefit_ending', `${left} Medicare Part A day(s) left in the benefit period (${prior} earlier + ${stayDays} this stay).`, 'Plan the next payer and the notice timing with case management.', { days_used: prior + stayDays, days_left: left });
      const s = stays.get(rk);
      if (!s) add('no_qualifying_stay', 'Medicare Part A with no qualifying hospital stay on file.', 'Get the hospital admit and discharge dates (inpatient, not observation), or record the waiver that applies.');
      else if (!yes(s.waiver)) {
        const ip = inpatientDays(s.hospital_admit, s.hospital_discharge);
        if (ip === null || ip < 3) add('short_qualifying_stay', `Hospital stay ${isoDate(s.hospital_admit) || '?'} to ${isoDate(s.hospital_discharge) || '?'} is ${ip ?? 'unknown'} inpatient day(s); Part A SNF coverage needs at least 3 (discharge day not counted).`, 'Check for observation days counted as inpatient, or a waiver; otherwise Part A will not cover the stay.', { inpatient_days: ip });
        const gap = daysBetween(s.hospital_discharge, s.snf_admit);
        if (gap !== null && gap > 30) add('late_admission', `Admitted ${gap} days after the hospital discharge; Part A SNF coverage usually needs admission within 30 days.`, 'Check whether the medical-appropriateness exception applies and document it.', { days_after_discharge: gap });
      }
    }
  }
  sortByStatus(items, ORDER, 'days_left');
  return { as_of: asOf, residents: new Set(today.map((d) => idKey(d.resident_id))).size, findings: items.length, by_status: countBy(items, 'status'), items };
}
