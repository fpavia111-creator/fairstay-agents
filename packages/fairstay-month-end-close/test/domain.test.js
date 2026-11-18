// Domain checks: month-end close.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkClose } from '../src/logic.js';

const asOf = '2026-04-06';
const T = (o = {}) => ({ entity: o.e ?? 'A', account: o.a ?? '5000', name: o.n ?? 'Supplies', activity: o.act ?? 100, prior_activity: o.prior ?? 100, balance: o.bal ?? 0 });
const st = (r) => r.items.map((i) => i.status);

test('balances per entity', () => {
  assert.deepEqual(st(checkClose([T({ bal: 10 }), T({ a: '1000', bal: -10 })], { asOf })), []);
  assert.deepEqual(st(checkClose([T({ bal: 10 }), T({ e: 'B', bal: -10 })], { asOf })), ['out_of_balance', 'out_of_balance']);
});

test('intercompany nets across entities', () => {
  const ok = [T({ n: 'Due from B', bal: 50 }), T({ a: '1', bal: -50 }), T({ e: 'B', n: 'Due to A', bal: -50 }), T({ e: 'B', a: '1', bal: 50 })];
  assert.deepEqual(st(checkClose(ok, { asOf })), []);
});

test('swings need both the percent and the minimum', () => {
  assert.deepEqual(st(checkClose([T({ act: 6000, prior: 1000 })], { asOf })), ['big_swing']);
  assert.deepEqual(st(checkClose([T({ act: 4000, prior: 1000 })], { asOf })), []);
  assert.deepEqual(st(checkClose([T({ act: 106000, prior: 100000 })], { asOf })), []);
});

test('accruals: credits count as activity too', () => {
  assert.deepEqual(st(checkClose([T({ act: -500, prior: -500 })], { asOf, accruals: [{ account: '5000', min: 400 }] })), []);
  assert.deepEqual(st(checkClose([], { asOf, accruals: [{ account: '5000', min: 400 }] })), ['missing_accrual']);
});

test('done tasks are never late', () => {
  assert.deepEqual(st(checkClose([], { asOf, tasks: [{ task: 'x', due: '2026-04-01', done_on: '2026-04-02' }] })), []);
  assert.deepEqual(st(checkClose([], { asOf, tasks: [{ task: 'x', due: '2026-04-01' }] })), ['late_task']);
});
