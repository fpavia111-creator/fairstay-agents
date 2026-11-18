// Yew logic: the case management weekly meeting list for skilled stays. No I/O.
import { str, num, isoDate, addDays, daysBetween, censusDays, sortByStatus, countBy, idKey, yes } from 'evergreen-core';

const ORDER = { nomnc_late: 0, custodial_on_skilled: 1, discharge_past_due: 2, review_overdue: 3, auth_ending_no_plan: 4, nomnc_due: 5, day_100_coming: 6, day_20_coming: 7 };
const SKILLED = new Set(['medicare_a', 'managed_care']);

/**
 * stays: [{ resident_id, last_covered_day, nomnc_given_on, planned_discharge, last_review, skilled (Y/N), auth_end, next_plan, part_a_days_used }]
 * opts: { asOf, reviewDays=7, nomncLeadDays=2, nomncWarnDays=5, day20WarnDays=7, day100WarnDays=14, authWarnDays=3 }
 */
export function weeklyList(census, stays, { asOf, reviewDays = 7, nomncLeadDays = 2, nomncWarnDays = 5, day20WarnDays = 7, day100WarnDays = 14, authWarnDays = 3 } = {}) {
  const now = censusDays(census, asOf, asOf).filter((d) => SKILLED.has(d.payer_type));
  const hist = censusDays(census, undefined, asOf);
  const info = new Map(stays.map((s) => [idKey(s.resident_id || s.resident_name), s]));
  const items = []; const seen = new Set();
  for (const d of now) {
    const k = idKey(d.resident_id); if (seen.has(k)) continue; seen.add(k);
    const s = info.get(k) || {};
    const base = { resident_id: d.resident_id, resident_name: d.resident_name, payer: d.payer, payer_type: d.payer_type };
    const add = (status, message, fix, extra = {}) => items.push({ status, ...base, ...extra, message, fix });
    // NOMNC: delivered at least 2 days before the last covered day (Medicare A and Medicare Advantage).
    const last = isoDate(s.last_covered_day); const given = isoDate(s.nomnc_given_on);
    if (last) {
      const due = addDays(last, -nomncLeadDays); const left = daysBetween(asOf, due);
      if (given ? given > due : left < 0) add('nomnc_late', given ? `The NOMNC was given ${given}, less than ${nomncLeadDays} days before the last covered day ${last}.` : `The last covered day is ${last} and no NOMNC is on file; it was due by ${due}.`, 'Give the notice now and move the last covered day so the resident has the full 2 days; days without valid notice are the facility\'s liability.', { last_covered_day: last, nomnc_due: due, days_left: left });
      else if (!given && left <= nomncWarnDays) add('nomnc_due', `The last covered day is ${last}; the NOMNC is due by ${due}.`, 'Deliver the NOMNC (CMS-10123) and get it signed, or note who was reached by phone.', { last_covered_day: last, nomnc_due: due, days_left: left });
    }
    if (str(s.skilled) && !yes(s.skilled)) add('custodial_on_skilled', `The team says skilled care has ended, but the resident is still on ${d.payer}.`, 'Set the last covered day, give the notices, and move the census to the next payer.');
    const dc = isoDate(s.planned_discharge); if (dc && dc < asOf) add('discharge_past_due', `Planned discharge was ${dc} (${daysBetween(dc, asOf)} days ago) and the resident is still on ${d.payer}.`, 'Update the discharge plan and tell the payer.', { planned_discharge: dc });
    const rev = isoDate(s.last_review); const since = rev ? daysBetween(rev, asOf) : null;
    if (since === null || since > reviewDays) add('review_overdue', rev ? `Last clinical review was ${rev} (${since} days ago).` : 'No clinical review is on file.', 'Review at this week\'s meeting: goals, therapy minutes, expected discharge.', { last_review: rev });
    const auth = isoDate(s.auth_end); if (d.payer_type === 'managed_care' && auth) { const left = daysBetween(asOf, auth); if (left <= authWarnDays && !str(s.next_plan)) add('auth_ending_no_plan', `The authorization ends ${auth} (${left} days) and no plan is recorded.`, 'Decide this week: extension request, discharge or payer change.', { auth_end: auth, days_left: left }); }
    if (d.payer_type === 'medicare_a') {
      const used = (num(s.part_a_days_used) || 0) + hist.filter((x) => idKey(x.resident_id) === k && x.payer_type === 'medicare_a').length;
      const to20 = 20 - used; const to100 = 100 - used;
      if (to20 >= 0 && to20 <= day20WarnDays) add('day_20_coming', `Medicare day 20 is ${addDays(asOf, to20)}; coinsurance starts on day 21.`, 'Tell the resident or family about the daily coinsurance and who will pay it (secondary insurance, Medicaid or private).', { benefit_day: used, days_left: to20 });
      if (to100 >= 0 && to100 <= day100WarnDays) add('day_100_coming', `Medicare day 100 is ${addDays(asOf, to100)}.`, 'Plan the next payer (hemlock-of-next-payer) and the notices.', { benefit_day: used, days_left: to100 });
    }
  }
  sortByStatus(items, ORDER, 'none');
  return { as_of: asOf, skilled_residents: seen.size, by_status: countBy(items, 'status'), items };
}
