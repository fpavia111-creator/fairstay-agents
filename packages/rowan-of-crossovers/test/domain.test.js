// Domain checks: crossovers and lesser-of.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCrossovers, lesserOf } from '../src/logic.js';

const asOf = '2026-04-30';
const M = (o = {}) => ({ resident_id: 'A', claim_id: 'X1', from: '2026-02-01', to: '2026-02-10', medicare_paid: o.mp ?? 3000, coinsurance: o.coins ?? 2000, deductible: o.ded ?? '', paid_on: o.paid ?? '2026-03-01', dual: o.dual ?? 'Y' });
const X = (o = {}) => ({ claim_id: o.id ?? 'x-1', billed_coinsurance: o.billed ?? 2000, paid_amount: o.paid ?? '', paid_on: o.on ?? '', billed_on: o.sent ?? '2026-03-05' });
const st = (r) => r.items.map((i) => i.status);

test('lesser-of arithmetic', () => {
  assert.equal(lesserOf({ coinsurance: 2000, medicarePaid: 1000, days: 10, medicaidRate: 200 }), 1000);
  assert.equal(lesserOf({ coinsurance: 500, medicarePaid: 1000, days: 10, medicaidRate: 200 }), 500);
  assert.equal(lesserOf({ coinsurance: 2000, medicarePaid: 3000, days: 10, medicaidRate: 200 }), 0);
  assert.equal(lesserOf({ coinsurance: 2000, medicarePaid: 3000, days: 10, medicaidRate: null }), null);
});

test('claim ids match across formats', () => {
  assert.deepEqual(st(checkCrossovers([M()], [X({ paid: 2000, on: '2026-04-01' })], { asOf, medicaidRate: 200 })), []);
});

test('the deductible counts as cost sharing', () => {
  const r = checkCrossovers([M({ coins: 1500, ded: 500 })], [X({ billed: 1500, paid: 0, on: '2026-04-01' })], { asOf });
  assert.deepEqual(st(r), ['wrong_amount', 'zero_paid_lesser_of', 'bad_debt_candidate']);
});

test('non-dual residents and recent payments are left alone', () => {
  assert.deepEqual(checkCrossovers([M({ dual: 'N' })], [], { asOf }).items, []);
  assert.deepEqual(checkCrossovers([M({ paid: '2026-04-20' })], [], { asOf }).items, []);
  assert.deepEqual(st(checkCrossovers([M({ paid: '2026-03-01' })], [], { asOf })), ['not_crossed_over']);
});

test('without lesser-of the full coinsurance is expected', () => {
  const r = checkCrossovers([M()], [X({ paid: 500, on: '2026-04-01' })], { asOf, medicaidRate: 200, useLesserOf: false });
  assert.deepEqual(st(r), ['underpaid', 'bad_debt_candidate']); assert.equal(r.items[0].amount, 1500);
});
