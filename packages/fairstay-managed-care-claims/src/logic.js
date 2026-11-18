// Fairstay Managed Care Claims logic: managed care per-diem claims against contract rates and authorizations. No I/O.
import { str, num, isoDate, round2, dateRange, rateFor, payerKey, sortByStatus, countBy, total, idKey } from 'fairstay-core';

const ORDER = { no_auth_number: 0, auth_not_found: 1, days_beyond_auth: 2, level_not_authorized: 3, paid_below_contract: 4, billed_below_contract: 5, no_contract_rate: 6 };

/** claims: [{claim_id, resident_id, payer, from, through, level, days, billed, paid, auth_number}]; rates: [{payer, level, rate, from, to}]; auths: [{auth_number, resident_id, payer, level, from, to}] */
export function checkManagedCare(claims, rates, auths, { tolerance = 1 } = {}) {
  const byNum = new Map(auths.map((a) => [idKey(a.auth_number), a]));
  // Rate table upper-cased once and each payer/level/date looked up once (it was rebuilt and scanned for every claim).
  const R = rates.map((r) => ({ ...r, level: str(r.level).toUpperCase() })); const rateMemo = new Map();
  const rateOf = (payer, level, date) => { const k = `${payer}\u0000${level}\u0000${date}`; if (!rateMemo.has(k)) rateMemo.set(k, rateFor(R, { payer, level, date })); return rateMemo.get(k); };
  const items = [];
  for (const c of claims) {
    const from = isoDate(c.from); const through = isoDate(c.through) || from;
    const days = num(c.days) ?? (from ? dateRange(from, through).length : 0);
    const level = str(c.level).toUpperCase();
    const base = { claim_id: str(c.claim_id), resident_id: str(c.resident_id) || str(c.resident_name), resident_name: str(c.resident_name) || null, payer: str(c.payer), level, from, through, days };
    const add = (status, amount, message, fix, extra = {}) => items.push({ status, ...base, amount: round2(amount), ...extra, message, fix });
    const rate = rateOf(c.payer, level, from);
    const billed = num(c.billed); const paid = num(c.paid);
    if (rate === null) add('no_contract_rate', 0, `No contract rate for ${base.payer} level ${level || '(none)'} on ${from}.`, 'Add the rate from the contract, or check the level code on the claim.');
    else {
      const expect = round2(rate * days);
      if (billed !== null && billed + tolerance < expect) add('billed_below_contract', expect - billed, `Billed ${billed}; the contract pays ${rate} a day (${expect} for ${days} days). Plans usually pay the lesser of billed and contract.`, 'Raise the charge master rate for this level to at least the contract rate and rebill.', { contract_amount: expect });
      if (paid !== null && paid + tolerance < Math.min(expect, billed ?? expect)) add('paid_below_contract', Math.min(expect, billed ?? expect) - paid, `Paid ${paid}; the contract amount is ${Math.min(expect, billed ?? expect)} (${rate} x ${days} days).`, 'Appeal the underpayment with the contract rate page attached.', { contract_amount: Math.min(expect, billed ?? expect) });
    }
    const n = str(c.auth_number);
    if (!n) { add('no_auth_number', 0, 'No authorization number on the claim.', 'Add the authorization number; managed care plans deny per-diem claims without it.'); continue; }
    const a = byNum.get(idKey(n));
    if (!a || payerKey(a.payer) !== payerKey(c.payer) || (idKey(a.resident_id) && idKey(a.resident_id) !== idKey(base.resident_id))) { add('auth_not_found', 0, `Authorization ${n} is not in the log for this resident and payer.`, 'Check the number against the plan\'s approval letter or portal printout.'); continue; }
    if (str(a.level) && str(a.level).toUpperCase() !== level) add('level_not_authorized', rate === null ? 0 : Math.max(0, rate - (rateOf(c.payer, str(a.level).toUpperCase(), from) || 0)) * days, `Billed level ${level}; authorization ${n} is for level ${str(a.level).toUpperCase()}.`, 'Bill the authorized level, or ask the plan to change the level with clinical notes.', { auth_level: str(a.level).toUpperCase() });
    const af = isoDate(a.from); const at = isoDate(a.to);
    const outside = from ? dateRange(from, through).filter((d) => (af && d < af) || (at && d > at)).length : 0;
    if (outside) add('days_beyond_auth', rate ? rate * outside : 0, `${outside} billed day(s) fall outside authorization ${n} (${af || '?'} to ${at || '?'}).`, 'Get the extension or new authorization before billing these days, or take them off the claim.', { days_outside: outside, auth_from: af, auth_to: at });
  }
  sortByStatus(items, ORDER);
  return { claims: claims.length, claims_with_findings: new Set(items.map((i) => i.claim_id)).size, underpaid: total(items.filter((i) => i.status === 'paid_below_contract'), 'amount'), billed_short: total(items.filter((i) => i.status === 'billed_below_contract'), 'amount'), at_risk_without_auth: total(items.filter((i) => ['days_beyond_auth', 'level_not_authorized'].includes(i.status)), 'amount'), by_status: countBy(items, 'status'), items };
}
