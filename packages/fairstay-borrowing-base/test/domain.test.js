// Domain checks: borrowing base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borrowingBase } from '../src/logic.js';

const asOf = '2026-03-31';
const R = (o = {}) => ({ resident_id: o.id ?? 'A', payer: o.payer ?? 'Medicare A', service_date: o.date ?? '2026-03-31', balance: o.bal ?? 1000 });

test('advance rate times eligible, capped by the line, less the loan', () => {
  const r = borrowingBase([R()], { asOf, terms: { line_limit: 500, outstanding: 100 } });
  assert.equal(r.borrowing_base, 850); assert.equal(r.available, 400);
});

test('age limits by payer type', () => {
  assert.equal(borrowingBase([R({ date: '2025-12-01' })], { asOf }).eligible, 1000);
  assert.equal(borrowingBase([R({ date: '2025-11-30' })], { asOf }).eligible, 0);
  assert.equal(borrowingBase([R({ payer: 'Private Pay', date: '2025-12-15' })], { asOf }).eligible, 0);
});

test('cross-aging only above the percent, per resident for private pay', () => {
  const p = (o) => R({ payer: 'Private Pay', ...o });
  assert.equal(borrowingBase([p({ bal: 100 }), p({ bal: 99, date: '2025-10-01' })], { asOf }).ineligibles.cross_aged, undefined);
  assert.equal(borrowingBase([p({ bal: 100 }), p({ bal: 101, date: '2025-10-01' })], { asOf }).ineligibles.cross_aged, 100);
  assert.equal(borrowingBase([p({ bal: 100 }), p({ id: 'B', bal: 500, date: '2025-10-01' })], { asOf }).ineligibles.cross_aged, undefined);
});

test('Medicare and Medicaid are never cut for concentration', () => {
  const r = borrowingBase([R({ bal: 9000 }), R({ payer: 'Sunrise HMO', bal: 1000 })], { asOf });
  assert.equal(r.ineligibles.concentration_excess, undefined);
  const r2 = borrowingBase([R({ bal: 1000 }), R({ payer: 'Sunrise HMO', bal: 1000 })], { asOf });
  assert.equal(r2.ineligibles.concentration_excess, 500);
});

test('payer types without a rate are listed, not counted', () => {
  const r = borrowingBase([R({ payer: 'Mystery Plan' })], { asOf });
  assert.equal(r.borrowing_base, 0); assert.equal(r.items[0].status, 'no_advance_rate');
});
