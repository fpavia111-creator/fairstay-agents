// Fairstay Licensing Calendar logic: licensing and credentialing calendar. No I/O.
import { str, isoDate, addDays, daysBetween, sortByStatus, countBy } from 'fairstay-core';

const ORDER = { expired: 0, staff_license_missing: 1, renewal_pending_past_expiry: 2, missing_standard_item: 3, expiring: 4, no_expiration_date: 5 };

/**
 * Items every nursing facility usually holds. Typical, not rules: your state sets its own list.
 * every = usual renewal cycle in months (for the note only).
 */
export const STANDARD_ITEMS = Object.freeze([
  { key: 'state_license', name: 'State nursing facility license', match: /(facility|nursing (home|facility)|state) licen[cs]e|^licen[cs]e$/i, every: 12 },
  { key: 'medicare_revalidation', name: 'Medicare enrollment revalidation (CMS-855A, about every 5 years)', match: /medicare.*(revalid|enrol|855)/i, every: 60 },
  { key: 'medicaid_revalidation', name: 'Medicaid provider revalidation (at least every 5 years)', match: /medicaid.*(revalid|enrol)/i, every: 60 },
  { key: 'clia', name: 'CLIA certificate (2 years)', match: /\bclia\b/i, every: 24 },
  { key: 'administrator_license', name: 'Licensed administrator (NHA) on file for the facility', match: /administrator|\bnha\b|\blnha\b/i, every: 24 },
  { key: 'food_permit', name: 'Food service permit', match: /food|kitchen|dietary/i, every: 12 },
  { key: 'fire_safety', name: 'Fire safety / life safety inspection or certificate', match: /fire|life safety|sprinkler/i, every: 12 },
]);

const DEFAULT_ROLES = ['RN', 'LPN', 'LVN', 'CNA', 'ADMINISTRATOR', 'NHA', 'PT', 'OT', 'SLP', 'RD'];
const roleKey = (v) => str(v).toUpperCase().replace(/[.\s]/g, '');
const nameKey = (v) => str(v).toLowerCase().replace(/[^a-z]/g, '');

/**
 * items: [{ item, facility, holder, role, number, expires, renewal_filed }]
 * staff: [{ name, role, facility }] (optional; licensed roles must have a license row)
 * opts: { asOf, warnDays=60, facilities=[], licensedRoles }
 */
export function checkLicensing(rows, staff = [], { asOf, warnDays = 60, facilities = [], licensedRoles = DEFAULT_ROLES } = {}) {
  const items = [];
  const R = rows.map((r, i) => ({ item: str(r.item), facility: str(r.facility) || null, holder: str(r.holder) || null, role: str(r.role) || null, number: str(r.number) || null, expires: isoDate(r.expires), renewal_filed: isoDate(r.renewal_filed), line: i + 1 }));
  for (const r of R) {
    const who = r.holder ? `${r.holder}'s ${r.item}` : r.item;
    const where = r.facility ? ` at ${r.facility}` : '';
    const base = { item: r.item, facility: r.facility, holder: r.holder, role: r.role, number: r.number, expires: r.expires, renewal_filed: r.renewal_filed, amount: 0 };
    if (!r.expires) { items.push({ status: 'no_expiration_date', ...base, days_left: null, message: `${who}${where} has no expiration date on the list.`, fix: 'Look it up on the license or the state lookup site and add the date.' }); continue; }
    const left = daysBetween(asOf, r.expires);
    if (left < 0 && !r.renewal_filed) items.push({ status: 'expired', ...base, days_left: left, message: `${who}${where} expired ${r.expires} (${-left} days ago) and no renewal is on file.`, fix: r.holder ? 'Take the person off licensed duties until it is renewed, and check the state lookup.' : 'Renew it now and ask the agency whether you can keep operating meanwhile.' });
    else if (left < 0) items.push({ status: 'renewal_pending_past_expiry', ...base, days_left: left, message: `${who}${where} expired ${r.expires}; the renewal was filed ${r.renewal_filed} and is not yet issued.`, fix: 'Get written proof that the renewal keeps it valid, and chase the agency.' });
    else if (left <= warnDays && !r.renewal_filed) items.push({ status: 'expiring', ...base, days_left: left, message: `${who}${where} expires ${r.expires} (${left} days).`, fix: 'Start the renewal now.' });
  }
  const facs = [...new Set([...facilities, ...R.filter((r) => !r.holder || /administrator|nha/i.test(`${r.role} ${r.item}`)).map((r) => r.facility).filter(Boolean)])];
  for (const f of facs) {
    const mine = R.filter((r) => !r.facility || r.facility === f);
    for (const s of STANDARD_ITEMS) {
      if (mine.some((r) => s.match.test(`${r.item} ${r.role || ''}`))) continue;
      items.push({ status: 'missing_standard_item', item: s.name, facility: f, holder: null, role: null, number: null, expires: null, renewal_filed: null, days_left: null, amount: 0, standard: s.key, message: `${f} has no entry for: ${s.name}.`, fix: 'Add it with its number and expiration date, or note why it does not apply in your state.' });
    }
  }
  const roles = new Set(licensedRoles.map(roleKey));
  for (const s of staff) {
    const role = roleKey(s.role); if (!roles.has(role)) continue;
    const n = nameKey(s.name);
    if (R.some((r) => r.holder && nameKey(r.holder) === n)) continue;
    items.push({ status: 'staff_license_missing', item: `${str(s.role)} license`, facility: str(s.facility) || null, holder: str(s.name), role: str(s.role), number: null, expires: null, renewal_filed: null, days_left: null, amount: 0, message: `${str(s.name)} works as ${str(s.role)}${s.facility ? ` at ${str(s.facility)}` : ''} and has no license on the list.`, fix: 'Verify the license on the state lookup and add it before the next shift.' });
  }
  sortByStatus(items, ORDER, 'none');
  items.sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || ((a.days_left ?? 9999) - (b.days_left ?? 9999)));
  return { as_of: asOf, items_on_list: R.length, facilities: facs.length, staff_checked: staff.filter((s) => roles.has(roleKey(s.role))).length, by_status: countBy(items, 'status'), items };
}
export { addDays };
