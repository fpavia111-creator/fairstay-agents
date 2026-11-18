// Fairstay Managed Care Authorizations logic: managed care authorizations against the daily census. No I/O.
import { str, num, isoDate, addDays, daysBetween, payerKey, censusDays, dateRange, dayRuns, sortByStatus, countBy, idKey } from 'fairstay-core';

const ORDER = { no_auth: 0, over_authorized_days: 1, level_differs: 2, review_overdue: 3, auth_ending: 4, review_due: 5 };
const NEEDS_AUTH = new Set(['managed_care']);

/**
 * census rows; auths: [{ resident_id, payer, auth_number, from, to (inclusive), level, days_authorized, next_review }]
 * opts: { start, asOf, warnDays=3, reviewWarnDays=2, authTypes=['managed_care'] }
 */
export function checkAuthorizations(census, auths, { start, asOf, warnDays = 3, reviewWarnDays = 2, authTypes = [...NEEDS_AUTH] } = {}) {
  const need = new Set(authTypes);
  const days = censusDays(census, start, asOf).filter((d) => need.has(d.payer_type) && d.bed_status === 'in_house');
  const byRes = new Map(); for (const a of auths) { const k = idKey(a.resident_id || a.resident_name); if (!byRes.has(k)) byRes.set(k, []); byRes.get(k).push({ ...a, from: isoDate(a.from), to: isoDate(a.to) || isoDate(a.from) }); }
  const names = new Map(); for (const r of census) if (r.resident_name) names.set(idKey(r.resident_id || r.resident_name), str(r.resident_name));
  // Is there a next authorization starting after this one and no later than the day after it ends? Start dates
  // per resident sorted once, then a binary search (it scanned every authorization for every one).
  const starts = new Map(); for (const [k, list] of byRes) starts.set(k, list.map((x) => x.from).filter(Boolean).sort());
  const renewedOf = (k, a) => { const s = starts.get(k) || []; const hi = addDays(a.to, 1); let lo = 0, up = s.length; while (lo < up) { const m = (lo + up) >> 1; if (s[m] > a.from) up = m; else lo = m + 1; } return lo < s.length && s[lo] <= hi; };
  const used = new Map(); const finds = [];
  for (const d of days.sort((a, b) => a.date.localeCompare(b.date))) {
    const list = (byRes.get(idKey(d.resident_id)) || []).filter((a) => (!a.payer || payerKey(a.payer) === payerKey(d.payer)) && a.from && a.from <= d.date && a.to >= d.date);
    const a = list[0];
    if (!a) { finds.push({ ...d, status: 'no_auth', auth_number: null }); continue; }
    const k = `${idKey(d.resident_id)}|${a.auth_number}|${a.from}`; const n = (used.get(k) || 0) + 1; used.set(k, n);
    const cap = num(a.days_authorized);
    if (cap !== null && n > cap) finds.push({ ...d, status: 'over_authorized_days', auth_number: str(a.auth_number), cap });
    else if (a.level && d.level && str(a.level).toUpperCase() !== str(d.level).toUpperCase()) finds.push({ ...d, status: 'level_differs', auth_number: str(a.auth_number), auth_level: str(a.level) });
  }
  const items = dayRuns(finds, (f) => `${f.resident_id}|${f.status}|${f.payer}|${f.auth_number || ''}|${f.auth_level || ''}`).map((r) => {
    const f = r.first; const span = r.from === r.to ? r.from : `${r.from} to ${r.to}`;
    const T = {
      no_auth: [`${r.days} day(s) with ${f.payer} (${span}) have no authorization covering them.`, 'Ask the plan for an authorization or retro-authorization now; days without one are usually denied.'],
      over_authorized_days: [`${r.days} day(s) (${span}) are past the ${f.cap} days authorized under ${f.auth_number}.`, 'Send clinicals for a concurrent review and an extension before billing.'],
      level_differs: [`The census level is ${f.level} for ${span}; authorization ${f.auth_number} is for level ${f.auth_level}.`, 'Ask the plan to update the authorized level, or correct the census level.'],
    }[f.status];
    return { status: f.status, resident_id: f.resident_id, resident_name: names.get(idKey(f.resident_id)) || null, payer: f.payer, auth_number: f.auth_number, level: f.level, from: r.from, to: r.to, days: r.days, message: T[0], fix: T[1] };
  });
  // Looking ahead from as_of: authorizations ending and reviews due, for residents still in the building on a payer that needs one.
  for (const d of censusDays(census, asOf, asOf).filter((x) => need.has(x.payer_type))) {
    for (const a of (byRes.get(idKey(d.resident_id)) || []).filter((x) => x.from <= asOf && x.to >= asOf)) {
      const base = { resident_id: d.resident_id, resident_name: names.get(idKey(d.resident_id)) || null, payer: d.payer, auth_number: str(a.auth_number), level: d.level, from: a.from, to: a.to };
      const left = daysBetween(asOf, a.to);
      const renewed = renewedOf(idKey(d.resident_id), a);
      if (left <= warnDays && !renewed) items.push({ status: 'auth_ending', ...base, days_left: left, message: `Authorization ${a.auth_number} ends ${a.to} (${left ? `${left} day(s)` : 'today'}) and no next authorization is on file.`, fix: 'Send updated clinicals for the next authorization, or plan the discharge or payer change.' });
      const rev = isoDate(a.next_review);
      if (rev) { const due = daysBetween(asOf, rev); if (due < 0) items.push({ status: 'review_overdue', ...base, review_on: rev, days_left: due, message: `The concurrent review for ${a.auth_number} was due ${rev} (${-due} day(s) ago).`, fix: 'Send the clinical update today and log the call.' }); else if (due <= reviewWarnDays) items.push({ status: 'review_due', ...base, review_on: rev, days_left: due, message: `The concurrent review for ${a.auth_number} is due ${rev}.`, fix: 'Prepare therapy minutes, nursing notes and the care plan for the reviewer.' }); }
    }
  }
  sortByStatus(items, ORDER, 'days');
  return { start, as_of: asOf, residents: new Set(days.map((d) => d.resident_id)).size, auth_days: days.length, days_without_auth: items.filter((i) => i.status === 'no_auth').reduce((s, i) => s + i.days, 0), by_status: countBy(items, 'status'), items };
}
