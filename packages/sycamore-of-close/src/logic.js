// Sycamore logic: month-end close checks. No I/O.
import { str, num, isoDate, daysBetween, idKey, sortByStatus, countBy, round2 } from 'evergreen-core';

const ORDER = { out_of_balance: 0, intercompany_not_netting: 1, suspense_balance: 2, missing_accrual: 3, late_task: 4, big_swing: 5, ppd_out_of_range: 6, task_due_soon: 7 };
const SUSPENSE = /suspense|clearing|unapplied|undistributed|unidentified/i;
const INTERCO = /intercompany|inter-company|due (to|from)/i;

/**
 * tb: [{ entity, account, name, activity, prior_activity, balance }] (debits positive, credits negative)
 * opts: { asOf, patientDays, swingPct=25, swingMin=5000, accruals: [{ account, min }], ppd: [{ account, low, high }], tasks, suspense (detail lines) }
 */
export function checkClose(tb, { asOf, patientDays = null, swingPct = 25, swingMin = 5000, accruals = [], ppd = [], tasks = [], suspense = [] } = {}) {
  const rows = tb.map((r, i) => ({ entity: str(r.entity) || 'main', account: str(r.account), name: str(r.name), activity: num(r.activity) || 0, prior: num(r.prior_activity), balance: num(r.balance) || 0, line: i + 1 }));
  const items = []; const add = (status, o) => items.push({ status, entity: null, account: null, name: null, amount: 0, ...o });
  const entities = [...new Set(rows.map((r) => r.entity))];
  for (const e of entities) { const s = round2(rows.filter((r) => r.entity === e).reduce((t, r) => t + r.balance, 0)); if (Math.abs(s) > 0.005) add('out_of_balance', { entity: e, amount: Math.abs(s), message: `The trial balance for ${e} is out of balance by ${s}.`, fix: 'Find the one-sided entry (often an import or a manual journal) before anything else.' }); }
  const ic = rows.filter((r) => INTERCO.test(r.name)); const icNet = round2(ic.reduce((t, r) => t + r.balance, 0));
  if (ic.length && Math.abs(icNet) > 0.005) add('intercompany_not_netting', { amount: Math.abs(icNet), message: `Intercompany balances across ${new Set(ic.map((r) => r.entity)).size} entities net to ${icNet}, not zero.`, fix: 'Match each due-to with its due-from; book the missing side.' });
  const byAcct = new Map(); for (const s of suspense) { const k = idKey(s.account); byAcct.set(k, [...(byAcct.get(k) || []), s]); }
  for (const r of rows.filter((x) => SUSPENSE.test(x.name) && Math.abs(x.balance) > 0.005)) {
    const det = byAcct.get(idKey(r.account)) || []; const oldest = det.map((d) => isoDate(d.date)).filter(Boolean).sort()[0];
    add('suspense_balance', { entity: r.entity, account: r.account, name: r.name, amount: Math.abs(r.balance), lines: det.length || null, oldest_days: oldest ? daysBetween(oldest, asOf) : null, message: `${r.name} holds ${r.balance}${det.length ? ` in ${det.length} line(s), the oldest ${daysBetween(oldest, asOf)} days old` : ''}.`, fix: 'Clear each line to the right resident account or expense before closing; unapplied resident cash may be a refund owed.' });
  }
  for (const a of accruals) {
    const r = rows.find((x) => idKey(x.account) === idKey(a.account)); const act = r ? Math.abs(r.activity) : 0; const min = num(a.min) || 0;
    if (act < min) add('missing_accrual', { entity: r?.entity || null, account: str(a.account), name: r?.name || str(a.name) || null, amount: round2(min - act), message: `${r?.name || a.account} has ${act} this month; at least ${min} is expected every month.`, fix: 'Book the accrual (invoices often arrive after close: pharmacy, therapy, utilities, agency staff).' });
  }
  for (const r of rows) {
    if (r.prior === null) continue; const diff = round2(r.activity - r.prior);
    if (Math.abs(diff) >= swingMin && Math.abs(diff) > Math.abs(r.prior) * swingPct / 100) add('big_swing', { entity: r.entity, account: r.account, name: r.name, amount: Math.abs(diff), activity: r.activity, prior_activity: r.prior, message: `${r.name} moved ${diff} from last month (${r.prior} to ${r.activity}).`, fix: 'Explain it (census, rate change, one-time item) or find the mispost.' });
  }
  if (patientDays) for (const p of ppd) {
    const rs = rows.filter((x) => idKey(x.account) === idKey(p.account)); if (!rs.length) continue;
    const v = round2(Math.abs(rs.reduce((t, x) => t + x.activity, 0)) / patientDays); const lo = num(p.low); const hi = num(p.high);
    if ((lo !== null && v < lo) || (hi !== null && v > hi)) add('ppd_out_of_range', { entity: rs[0].entity, account: rs[0].account, name: rs[0].name, amount: v, ppd: v, message: `${rs[0].name} is ${v} per patient day; the usual range is ${lo ?? '-'} to ${hi ?? '-'}.`, fix: v < (lo ?? -Infinity) ? 'Look for a missing invoice or accrual.' : 'Look for a duplicate, a mispost or a true cost increase.' });
  }
  for (const t of tasks) {
    const due = isoDate(t.due); const done = isoDate(t.done_on); if (!due || done) continue; const left = daysBetween(asOf, due);
    if (left < 0) add('late_task', { name: str(t.task), owner: str(t.owner) || null, due_date: due, message: `"${str(t.task)}" was due ${due} (${-left} days ago)${t.owner ? `, owner ${str(t.owner)}` : ''}.`, fix: 'Get it done or move the close date.' });
    else if (left <= 1) add('task_due_soon', { name: str(t.task), owner: str(t.owner) || null, due_date: due, message: `"${str(t.task)}" is due ${due}.`, fix: 'Confirm the owner has what they need.' });
  }
  sortByStatus(items, ORDER);
  return { as_of: asOf, entities: entities.length, accounts: rows.length, tasks_open: tasks.filter((t) => !isoDate(t.done_on)).length, by_status: countBy(items, 'status'), items };
}
