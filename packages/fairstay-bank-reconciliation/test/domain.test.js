// Domain checks: bank reconciliation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from '../src/logic.js';

const asOf = '2026-03-31';
const L = (o = {}) => ({ account: o.acct ?? '100', date: o.date ?? '2026-03-30', amount: o.amount ?? 100, check_no: o.check ?? '', description: o.desc ?? '' });
const st = (r) => r.items.map((i) => i.status);

test('amounts match within the date window, closest date first', () => {
  assert.deepEqual(st(reconcile([L({ date: '2026-03-30' })], [L({ date: '2026-03-27' })], { asOf })), []);
  assert.deepEqual(st(reconcile([L({ date: '2026-03-30' })], [L({ date: '2026-03-20' })], { asOf })), ['bank_not_in_books', 'deposit_in_transit_long']);
  const r = reconcile([L({ date: '2026-03-28' }), L({ date: '2026-03-31' })], [L({ date: '2026-03-30' })], { asOf });
  assert.equal(r.items[0].date, '2026-03-28');
});

test('different accounts never match', () => {
  assert.deepEqual(st(reconcile([L({ acct: '200' })], [L()], { asOf })), ['bank_not_in_books']);
});

test('checks match by number and report a different amount', () => {
  const r = reconcile([L({ check: '0101', amount: -50 })], [L({ check: '101', amount: -55 })], { asOf });
  assert.deepEqual(st(r), ['amount_differs']); assert.equal(r.items[0].amount, 5);
});

test('outstanding checks are normal until stale', () => {
  assert.deepEqual(st(reconcile([], [L({ amount: -10, check: '5', date: '2026-01-15' })], { asOf })), []);
  assert.deepEqual(st(reconcile([], [L({ amount: -10, check: '5', date: '2025-12-15' })], { asOf })), ['stale_check']);
});

test('the reconciliation balances when every item is listed', () => {
  const r = reconcile([L({ amount: -5, desc: 'FEE' })], [L({ amount: -20, check: '9' })], { asOf, balances: { 100: { bank: 975, book: 960 } } });
  assert.equal(r.reconciliation[0].unexplained, 0);
  const off = reconcile([L({ amount: -5 })], [L({ amount: -20, check: '9' })], { asOf, balances: { 100: { bank: 985, book: 960 } } });
  assert.equal(off.reconciliation[0].unexplained, 10); assert.equal(off.items[0].status, 'unexplained_difference');
});
