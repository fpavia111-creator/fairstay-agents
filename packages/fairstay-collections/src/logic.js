// Fairstay Collections logic: open receivables by payer type, with the reason each account is stuck. No I/O.
import { str, num, isoDate, addDays, daysBetween, payerType, agingBucket, sortByStatus, countBy, total, round2 } from 'fairstay-core';

const ORDER = { timely_filing_missed: 0, timely_filing_at_risk: 1, credit_balance: 2, denied: 3, no_followup: 4, not_billed: 5, medicaid_pending: 6 };
export const FILING_DAYS = Object.freeze({ medicare_a: 365, medicare_b: 365, medicaid: 365, medicaid_pending: 365, managed_care: 90, hospice: 90, insurance: 90, va: 180 });
export const BUCKETS = Object.freeze(['0-30', '31-60', '61-90', '91-120', '121-180', '181-365', '365+']);
const EDGES = [30, 60, 90, 120, 180, 365];

/**
 * rows: [{ resident_id, resident_name, payer, payer_type, claim_id, from, to, billed_on, balance, last_follow_up, note }]
 * opts: { asOf, followUpDays=30, warnDays=30, billLagDays=10, filingDays: { payer_type: days } }
 */
export function checkCollections(rows, { asOf, followUpDays = 30, warnDays = 30, billLagDays = 10, filingDays = {} } = {}) {
  const filing = { ...FILING_DAYS, ...filingDays };
  const aging = {}; const items = []; let open = 0;
  rows.forEach((r, i) => {
    const bal = num(r.balance); if (bal === null || bal === 0) return;
    open++;
    const type = payerType(r.payer, r.payer_type);
    const from = isoDate(r.from); const to = isoDate(r.to) || from;
    const age = to ? daysBetween(to, asOf) : null;
    const bucket = agingBucket(age, EDGES);
    aging[type] ??= {}; aging[type][bucket] = round2((aging[type][bucket] || 0) + bal);
    const billed = isoDate(r.billed_on); const fu = isoDate(r.last_follow_up); const note = str(r.note);
    const base = { resident_id: str(r.resident_id) || str(r.resident_name), resident_name: str(r.resident_name) || null, payer: str(r.payer), payer_type: type, claim_id: str(r.claim_id) || null, from, to, age_days: age, bucket, balance: bal, line: i + 1 };
    const add = (status, message, fix, extra = {}) => items.push({ status, ...base, ...extra, amount: Math.abs(bal), message, fix });
    if (bal < 0) return add('credit_balance', `Credit balance of ${-bal} with ${base.payer}.`, type.startsWith('medicare') || type.startsWith('medicaid') ? 'Find the cause and return a government overpayment within 60 days of finding it; list Medicare credits on the quarterly credit balance report.' : 'Find the cause, then refund or apply the credit and document it.');
    if (!billed && to && filing[type]) {
      const deadline = addDays(to, filing[type]); const left = daysBetween(asOf, deadline);
      if (left < 0) return add('timely_filing_missed', `Never billed; the ${filing[type]}-day filing limit for ${base.payer} passed on ${deadline}.`, 'Check for a good-cause exception or proof of earlier filing; otherwise write it off with approval.', { filing_deadline: deadline });
      if (left <= warnDays) return add('timely_filing_at_risk', `Not billed yet; the filing limit for ${base.payer} is ${deadline} (${left ? `${left} days` : 'today'}).`, 'Bill it this week and keep the acceptance report.', { filing_deadline: deadline });
    }
    if (/deni|reject|not covered|\b(co|pr|oa|pi)-?\d/i.test(note)) { const code = /\b(CO|PR|OA|PI)-?(\d+)\b/i.exec(note); return add('denied', `Denied or rejected${code ? ` (reason code ${code[1].toUpperCase()}-${code[2]})` : ''}; see the status note.`, 'Correct and resubmit, or appeal before the deadline (fairstay-denial-appeals tracks appeal deadlines).', { reason_code: code ? `${code[1].toUpperCase()}-${code[2]}` : null }); }
    if (type === 'medicaid_pending') return add('medicaid_pending', `A balance of ${bal} is waiting on a Medicaid decision (${age} days since the service ended).`, 'Follow the application in fairstay-medicaid-pending; bill Medicaid as soon as it is approved.');
    if (!billed && age !== null && age > billLagDays) return add('not_billed', `Not billed ${age} days after the service ended.`, 'Bill it, or note why it is held.');
    if (billed && age !== null && age > 30) {
      const since = daysBetween(fu || billed, asOf);
      if (since > followUpDays) return add('no_followup', fu ? `No follow-up for ${since} days on a ${age}-day-old balance.` : `No follow-up recorded in the ${since} days since billing (balance ${age} days old).`, 'Check the claim status with the payer and note the next step and date.', { days_since_follow_up: since });
    }
  });
  sortByStatus(items, ORDER);
  const order = Object.fromEntries(BUCKETS.map((b, i) => [b, i]));
  const agingRows = Object.entries(aging).map(([payer_type, b]) => ({ payer_type, ...Object.fromEntries(BUCKETS.map((k) => [k, b[k] || 0])), total: round2(Object.values(b).reduce((s, x) => s + x, 0)) })).sort((a, b) => b.total - a.total);
  const all = rows.map((r) => num(r.balance) || 0);
  const over90 = round2(agingRows.reduce((s, r) => s + BUCKETS.filter((b) => order[b] >= 3).reduce((t, b) => t + r[b], 0), 0));
  return { as_of: asOf, open_accounts: open, total_ar: round2(all.reduce((s, x) => s + x, 0)), over_90: over90, at_risk: total(items.filter((i) => ['timely_filing_missed', 'timely_filing_at_risk', 'denied'].includes(i.status)), 'amount'), aging: agingRows, by_status: countBy(items, 'status'), items };
}
