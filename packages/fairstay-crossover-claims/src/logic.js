// Fairstay Crossover Claims logic: Medicare-to-Medicaid crossovers for dual-eligible residents. No I/O.
import { str, num, isoDate, daysBetween, dateRange, idKey, yes, sortByStatus, countBy, total, round2 } from 'fairstay-core';

const ORDER = { not_crossed_over: 0, wrong_amount: 1, underpaid: 2, no_response: 3, zero_paid_lesser_of: 4, bad_debt_candidate: 5 };

/**
 * Lesser-of: many states pay the smaller of the Medicare cost sharing and (the Medicaid rate for the days less what Medicare paid).
 * Returns null when there is no Medicaid rate to compare with.
 */
export function lesserOf({ coinsurance, medicarePaid, days, medicaidRate }) {
  if (medicaidRate === null || medicaidRate === undefined || !days) return null;
  return round2(Math.max(0, Math.min(coinsurance, medicaidRate * days - medicarePaid)));
}

/**
 * medicare: [{ resident_id, resident_name, claim_id, from, to, days, medicare_paid, coinsurance, paid_on, dual }]
 * crossovers: [{ claim_id, billed_coinsurance, paid_amount, paid_on, billed_on }]
 * opts: { asOf, waitDays=30, responseDays=45, medicaidRate, lesserOf=true, tolerance=0.01 }
 */
export function checkCrossovers(medicare, crossovers, { asOf, waitDays = 30, responseDays = 45, medicaidRate = null, useLesserOf = true, tolerance = 0.01 } = {}) {
  const xo = new Map(); for (const x of crossovers) { const k = idKey(x.claim_id); if (!xo.has(k)) xo.set(k, []); xo.get(k).push(x); }
  const items = []; let duals = 0; let coinsTotal = 0;
  medicare.forEach((m, i) => {
    const coins = round2((num(m.coinsurance) || 0) + (num(m.deductible) || 0)); if (coins <= 0) return;
    if (str(m.dual) && !yes(m.dual)) return;
    duals++; coinsTotal += coins;
    const from = isoDate(m.from); const to = isoDate(m.to) || from;
    const days = num(m.days) ?? (from ? dateRange(from, to).length : 0); const mPaid = num(m.medicare_paid) || 0;
    const base = { resident_id: str(m.resident_id) || str(m.resident_name), resident_name: str(m.resident_name) || null, claim_id: str(m.claim_id) || null, from, to, days, coinsurance: coins, line: i + 1 };
    const add = (status, amount, message, fix, extra = {}) => items.push({ status, ...base, amount: round2(amount), message, fix, ...extra });
    const xs = xo.get(idKey(m.claim_id)) || [];
    const paidOn = isoDate(m.paid_on);
    if (!xs.length) { const wait = paidOn && asOf ? daysBetween(paidOn, asOf) : null; if (wait === null || wait > waitDays) add('not_crossed_over', coins, `Medicare left ${coins} in cost sharing${paidOn ? ` (paid ${paidOn}, ${wait} days ago)` : ''} and no Medicaid crossover is on file.`, 'Check whether the claim crossed over automatically; if not, bill Medicaid for the coinsurance.'); return; }
    const billed = round2(xs.reduce((s, x) => s + (num(x.billed_coinsurance) ?? coins), 0));
    const paid = round2(xs.reduce((s, x) => s + (num(x.paid_amount) || 0), 0));
    const decided = xs.some((x) => isoDate(x.paid_on) || num(x.paid_amount) !== null);
    const expected = useLesserOf ? lesserOf({ coinsurance: coins, medicarePaid: mPaid, days, medicaidRate }) : coins;
    if (Math.abs(billed - coins) > tolerance) add('wrong_amount', Math.abs(coins - billed), `The crossover billed ${billed}; Medicare's cost sharing is ${coins}.`, 'Correct the crossover to the Medicare coinsurance and deductible on the remit.', { billed_coinsurance: billed });
    if (!decided) { const sent = isoDate(xs[0].billed_on); const age = sent && asOf ? daysBetween(sent, asOf) : null; if (age !== null && age > responseDays) add('no_response', coins, `Crossover sent ${sent} (${age} days) with no Medicaid response.`, 'Check the claim status with the state Medicaid program.'); return; }
    if (expected !== null && paid + tolerance < expected) { add('underpaid', expected - paid, `Medicaid paid ${paid}; the lesser-of amount at the Medicaid rate is ${expected}.`, 'Ask Medicaid to reprocess, with the lesser-of calculation attached.', { expected }); }
    else if (paid <= tolerance) add('zero_paid_lesser_of', 0, `Medicaid paid nothing${expected === 0 ? ', which matches lesser-of (Medicare already paid more than the Medicaid rate)' : ''}.`, expected === null ? 'Give a Medicaid rate in the rules to check this against lesser-of.' : 'Keep the Medicaid remittance; it supports the Medicare bad debt claim.', { expected });
    const left = round2(coins - paid);
    if (left > tolerance) add('bad_debt_candidate', left, `${left} of Medicare cost sharing is unpaid after Medicaid paid ${paid}.`, 'Add it to the Medicare bad debt log with the Medicaid remittance (dual-eligible residents do not need a collection effort).', { medicaid_paid: paid });
  });
  sortByStatus(items, ORDER);
  return { as_of: asOf, dual_claims: duals, cost_sharing: round2(coinsTotal), not_crossed_over: total(items.filter((i) => i.status === 'not_crossed_over'), 'amount'), bad_debt: total(items.filter((i) => i.status === 'bad_debt_candidate'), 'amount'), by_status: countBy(items, 'status'), items };
}
