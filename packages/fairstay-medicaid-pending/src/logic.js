// Fairstay Medicaid Pending logic: Medicaid pending applications. No I/O.
import { str, num, isoDate, daysBetween, addDays, censusDays, sortByStatus, countBy, total, idKey, listOf, agingBucket } from 'fairstay-core';

const ORDER = { not_applied: 0, appeal_window_closing: 1, appeal_window_closed: 2, docs_overdue: 3, decision_overdue: 4, approved_not_billed: 5, liability_missing: 6, no_followup: 7, docs_due_soon: 8 };

export function appStatus(v) {
  const s = str(v).toLowerCase();
  if (/not (approved|eligible)|disapprov|den(y|ied)|ineligible|reject/.test(s)) return 'denied';
  if (/withdr|cancel|closed/.test(s)) return 'withdrawn';
  if (/approv|eligible|granted/.test(s)) return 'approved';
  if (/rfi|request|info|docs|verification/.test(s)) return 'rfi';
  return 'pending';
}

/**
 * opts: { asOf, decisionDays=45, followupDays=14, appealDays=30, docsWarnDays=7, census: rows|null }
 */
export function checkPending(apps, { asOf, decisionDays = 45, followupDays = 14, appealDays = 30, docsWarnDays = 7, census = null } = {}) {
  const items = [];
  const byRes = new Map(apps.map((a) => [idKey(a.resident_id || a.resident_name), a]));
  if (census) {
    const seen = new Set();
    for (const d of censusDays(census, asOf, asOf)) {
      const k = idKey(d.resident_id);
      if (d.payer_type === 'medicaid_pending' && !byRes.has(k) && !seen.has(k)) { seen.add(k); items.push({ status: 'not_applied', resident_id: d.resident_id, resident_name: d.resident_name, amount: 0, message: 'The census has this resident as Medicaid pending, but there is no application on file.', fix: 'Find out whether an application was filed; if not, file it now (coverage can reach back only a limited time).' }); }
    }
  }
  for (const a of apps) {
    const st = appStatus(a.status); const applied = isoDate(a.applied_on); const bal = num(a.pending_balance) || 0;
    const base = { resident_id: str(a.resident_id) || str(a.resident_name), resident_name: str(a.resident_name) || null, application_status: st, applied_on: applied, days_pending: applied ? daysBetween(applied, asOf) : null, amount: bal };
    const add = (status, message, fix, extra = {}) => items.push({ status, ...base, ...extra, message, fix });
    if (st === 'pending' || st === 'rfi') {
      const age = base.days_pending;
      if (age !== null && age > decisionDays) add('decision_overdue', `Applied ${applied}, ${age} days ago; the state decision time is ${decisionDays} days.`, 'Call the caseworker, ask for the decision date in writing, and escalate to the supervisor if needed.');
      const outstanding = listOf(a.docs_requested).filter((d) => !listOf(a.docs_received).map((x) => x.toLowerCase()).includes(d.toLowerCase()));
      const due = isoDate(a.docs_due);
      if (outstanding.length && due) {
        const left = daysBetween(asOf, due);
        if (left < 0) add('docs_overdue', `${outstanding.length} requested document(s) were due ${due}: ${outstanding.join(', ')}.`, 'Send what you have today and ask for an extension in writing; a missed request can close the application.', { docs_outstanding: outstanding, docs_due: due });
        else if (left <= docsWarnDays) add('docs_due_soon', `${outstanding.length} document(s) due ${due} (${left} days): ${outstanding.join(', ')}.`, 'Chase the family or bank for these documents now.', { docs_outstanding: outstanding, docs_due: due });
      }
      const last = isoDate(a.last_contact); const since = last ? daysBetween(last, asOf) : null;
      if (since === null || since > followupDays) add('no_followup', last ? `No contact with the caseworker for ${since} days (last ${last}).` : 'No contact with the caseworker recorded.', 'Call or write to the caseworker and log the contact.', { days_since_contact: since });
    }
    if (st === 'approved') {
      const eff = isoDate(a.effective_date); const billed = isoDate(a.billed_through);
      const lag = billed ? daysBetween(billed, asOf) : null;
      if (!billed || lag > 31) add('approved_not_billed', `Approved${eff ? ` from ${eff}` : ''}, ${billed ? `billed only through ${billed}` : 'not billed yet'}.`, 'Bill Medicaid for the approved days now, from the effective date; timely filing runs from the service dates.', { effective_date: eff, billed_through: billed });
      if (str(a.patient_liability) === '') add('liability_missing', 'Approved, but no patient liability (share of cost) amount is recorded.', 'Get the liability notice and set it up, so the resident portion is billed and the Medicaid claim is reduced by it.');
    }
    if (st === 'denied' && !isoDate(a.appeal_filed)) {
      const dec = isoDate(a.decision_date);
      if (dec) {
        const deadline = addDays(dec, appealDays); const left = daysBetween(asOf, deadline);
        if (left < 0) add('appeal_window_closed', `Denied ${dec}; the ${appealDays}-day window for a fair hearing request passed on ${deadline}.`, 'Check whether a new application (with a new start date) or a late-filing exception is possible.', { appeal_deadline: deadline, days_left: left });
        else add('appeal_window_closing', `Denied ${dec}; request a fair hearing by ${deadline} (${left} days).`, 'Decide today whether to appeal or reapply, and file before the deadline.', { appeal_deadline: deadline, days_left: left });
      }
    }
  }
  sortByStatus(items, ORDER);
  const open = apps.filter((a) => ['pending', 'rfi'].includes(appStatus(a.status)));
  const aging = {}; for (const a of open) { const b = agingBucket(daysBetween(isoDate(a.applied_on), asOf)); aging[b] = Math.round(((aging[b] || 0) + (num(a.pending_balance) || 0)) * 100) / 100; }
  return { as_of: asOf, applications: apps.length, open: open.length, pending_balance: total(open, (a) => num(a.pending_balance)), pending_balance_by_age: aging, oldest_days: open.length ? Math.max(...open.map((a) => daysBetween(isoDate(a.applied_on), asOf) ?? 0)) : 0, by_status: countBy(items, 'status'), items };
}
