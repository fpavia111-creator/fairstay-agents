// Hemlock logic: when each long-stay resident's current payer runs out, and whether the next one is planned. No I/O.
import { str, num, isoDate, addDays, daysBetween, censusDays, countBy, idKey, round2 } from 'evergreen-core';

const ORDER = { plan_needed: 0, apply_medicaid: 1, funds_low: 2, plan_in_place: 3 };

/**
 * plans: [{ resident_id, next_payer, part_a_days_used, auth_end, private_funds, daily_rate, monthly_income, medicaid_applied_on }]
 * opts: { asOf, horizonDays=30, applyLeadDays=90, benefitDays=100 }
 */
export function planNextPayer(census, plans, { asOf, horizonDays = 30, applyLeadDays = 90, benefitDays = 100 } = {}) {
  const now = censusDays(census, asOf, asOf);
  const hist = censusDays(census, undefined, asOf);
  const plan = new Map(plans.map((p) => [idKey(p.resident_id || p.resident_name), p]));
  const items = []; const seen = new Set();
  for (const d of now) {
    const k = idKey(d.resident_id); if (seen.has(k)) continue; seen.add(k);
    const p = plan.get(k) || {}; const next = str(p.next_payer);
    const base = { resident_id: d.resident_id, resident_name: d.resident_name, payer: d.payer, payer_type: d.payer_type, next_payer: next || null };
    let runsOut = null; let why = '';
    if (d.payer_type === 'medicare_a') {
      const used = (num(p.part_a_days_used) || 0) + hist.filter((x) => idKey(x.resident_id) === k && x.payer_type === 'medicare_a').length;
      const left = benefitDays - used;
      runsOut = addDays(asOf, Math.max(0, left)); why = `Medicare Part A day ${benefitDays} falls on ${runsOut} (${used} used)`;
    } else if (d.payer_type === 'managed_care' && isoDate(p.auth_end)) { runsOut = isoDate(p.auth_end); why = `the managed care authorization ends ${runsOut}`; }
    else if (d.payer_type === 'private') {
      const funds = num(p.private_funds); const rate = num(p.daily_rate);
      if (funds !== null && rate) {
        const net = rate - (num(p.monthly_income) || 0) * 12 / 365;
        const days = net > 0 ? Math.floor(funds / net) : Infinity;
        if (days !== Infinity) {
          runsOut = addDays(asOf, days); why = `private funds of ${funds} last about ${days} days at ${round2(net)} a day net of income`;
          const applied = isoDate(p.medicaid_applied_on);
          if (!applied && days <= applyLeadDays) items.push({ status: 'apply_medicaid', ...base, runs_out_on: runsOut, days_left: days, message: `Private funds run out about ${runsOut} (${days} days); no Medicaid application on file.`, fix: 'Start the Medicaid application now: gathering 60 months of records takes weeks, and coverage only reaches back a limited time.' });
          else if (days <= horizonDays) items.push({ status: 'funds_low', ...base, runs_out_on: runsOut, days_left: days, message: `Private funds run out about ${runsOut} (${days} days)${applied ? `; Medicaid applied ${applied}` : ''}.`, fix: 'Talk with the family about the gap until Medicaid decides, and keep the application moving.' });
          continue;
        }
      }
      continue;
    } else continue;
    const left = daysBetween(asOf, runsOut);
    if (left > horizonDays) continue;
    if (!next) items.push({ status: 'plan_needed', ...base, runs_out_on: runsOut, days_left: left, message: `${why[0].toUpperCase() + why.slice(1)}, in ${left} days, and no next payer is planned.`, fix: 'Meet the resident or family this week: Medicaid application, private pay agreement, or discharge plan, and the notices that go with it.' });
    else items.push({ status: 'plan_in_place', ...base, runs_out_on: runsOut, days_left: left, message: `${why[0].toUpperCase() + why.slice(1)}, in ${left} days; next payer planned: ${next}.`, fix: 'Confirm the next payer\'s paperwork is complete before the change date.' });
  }
  items.sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || (a.days_left - b.days_left));
  return { as_of: asOf, residents: seen.size, horizon_days: horizonDays, by_status: countBy(items, 'status'), items };
}
