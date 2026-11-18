// Olive logic: change of ownership (CHOW) tracker. No I/O.
import { str, num, isoDate, addDays, daysBetween, sortByStatus, countBy } from 'evergreen-core';

const ORDER = { late: 0, blocked: 1, missing_standard_step: 2, due_soon: 3, open: 4 };

/**
 * Standard steps with typical lead times in days before closing (negative = after closing).
 * Typical, not rules: the state, the Medicare contractor and each payer set their own.
 */
export const STANDARD_STEPS = Object.freeze([
  { key: 'medicare_855a', area: 'Medicare', name: 'Medicare CHOW enrollment (CMS-855A) to the Medicare contractor', lead: 90, match: /855a|medicare (chow|enrollment)|\bmac\b/i },
  { key: 'provider_agreement', area: 'Medicare', name: 'Decide on assignment of the Medicare provider agreement (and its liabilities)', lead: 90, match: /provider agreement|assign(ment)? of (the )?(medicare )?agreement/i },
  { key: 'medicaid_enrollment', area: 'Medicaid', name: 'Medicaid CHOW / provider enrollment with the state', lead: 60, match: /medicaid (chow|enrol)/i },
  { key: 'state_license', area: 'License', name: 'State nursing facility license application for the new owner', lead: 60, match: /licen[cs]e (application|chow)|state licen/i },
  { key: 'resident_notice', area: 'Residents', name: 'Written notice to residents and families', lead: 30, match: /resident.*notice|notice.*resident|famil(y|ies)/i },
  { key: 'mco_contracts', area: 'Payers', name: 'Managed care contracts and credentialing for the new owner', lead: 90, match: /managed care|\bmco\b|credential/i },
  { key: 'npi_ein', area: 'Payers', name: 'New NPI and EIN set up and linked', lead: 75, match: /\bnpi\b|\bein\b/i },
  { key: 'bank_lockbox', area: 'Banking', name: 'Operating accounts and lockbox for the new owner', lead: 30, match: /bank|lockbox/i },
  { key: 'payroll_setup', area: 'Payroll', name: 'Payroll, benefits and workers compensation for the new owner', lead: 30, match: /payroll|workers.?comp|benefit/i },
  { key: 'insurance', area: 'Insurance', name: 'General and professional liability insurance bound from closing', lead: 14, match: /insurance|liability|\bgl\b|\bpl\b/i },
  { key: 'vendor_contracts', area: 'Vendors', name: 'Pharmacy, therapy and other vendor contracts assigned or new', lead: 30, match: /vendor|pharmacy|therapy contract/i },
  { key: 'clia', area: 'Licenses', name: 'CLIA certificate change of ownership', lead: 30, match: /\bclia\b/i },
  { key: 'pbj_access', area: 'Systems', name: 'CMS systems access (PBJ, iQIES) for the new owner', lead: 14, match: /\bpbj\b|iqies|casper|cms (system|access)/i },
  { key: 'census_cutoff', area: 'Billing', name: 'Census and AR cutoff at closing (who bills which days)', lead: 0, match: /cut-?off|census.*clos|ar split/i },
  { key: 'final_cost_report', area: 'Medicare', name: 'Seller\'s terminating cost report (due 5 months after the CHOW)', lead: -150, match: /cost report/i },
]);

/**
 * steps: [{ step, area, owner, due, days_before_close, done_on, blocked_by }]
 * opts: { asOf, closeDate, warnDays=14 }
 */
export function trackChow(steps, { asOf, closeDate, warnDays = 14 } = {}) {
  const S = steps.map((s, i) => { const due = isoDate(s.due) || (num(s.days_before_close) !== null && closeDate ? addDays(closeDate, -num(s.days_before_close)) : null); return { step: str(s.step), area: str(s.area) || null, step_owner: str(s.owner) || null, due, done_on: isoDate(s.done_on), blocked_by: str(s.blocked_by) || null, contact_email: str(s.contact_email) || null, line: i + 1 }; });
  const done = (name) => S.some((x) => x.done_on && x.step.toLowerCase() === name.toLowerCase());
  const items = [];
  for (const s of S) {
    if (s.done_on) continue;
    const left = s.due ? daysBetween(asOf, s.due) : null; const base = { ...s, days_left: left, amount: 0 };
    if (s.blocked_by && !done(s.blocked_by)) items.push({ status: 'blocked', ...base, message: `"${s.step}" is waiting on "${s.blocked_by}"${s.due ? `, and is due ${s.due}` : ''}.`, fix: 'Clear the blocking step first, or find a way around it.' });
    else if (left !== null && left < 0) items.push({ status: 'late', ...base, message: `"${s.step}" was due ${s.due} (${-left} days ago)${s.step_owner ? `, owner ${s.step_owner}` : ''}.`, fix: 'Do it now; late filings can delay the new owner\'s billing for months.' });
    else if (left !== null && left <= warnDays) items.push({ status: 'due_soon', ...base, message: `"${s.step}" is due ${s.due} (${left} days).`, fix: 'Confirm the owner has what they need.' });
    else items.push({ status: 'open', ...base, message: `"${s.step}" is open${s.due ? `, due ${s.due}` : ' with no due date'}.`, fix: s.due ? 'No action yet.' : 'Give it a due date.' });
  }
  for (const st of STANDARD_STEPS) {
    if (S.some((s) => st.match.test(`${s.step} ${s.area || ''}`))) continue;
    const due = closeDate ? addDays(closeDate, -st.lead) : null;
    items.push({ status: 'missing_standard_step', step: st.name, area: st.area, step_owner: null, due, days_left: due ? daysBetween(asOf, due) : null, amount: 0, standard: st.key, message: `Your list has no step for: ${st.name}${due ? ` (typically by ${due})` : ''}.`, fix: 'Add it with an owner and a due date, or note why it does not apply.' });
  }
  sortByStatus(items, ORDER, 'none');
  items.sort((a, b) => (ORDER[a.status] - ORDER[b.status]) || ((a.days_left ?? 9999) - (b.days_left ?? 9999)));
  return { as_of: asOf, close_date: closeDate, days_to_close: closeDate ? daysBetween(asOf, closeDate) : null, steps: S.length, done: S.filter((s) => s.done_on).length, by_status: countBy(items, 'status'), items };
}
