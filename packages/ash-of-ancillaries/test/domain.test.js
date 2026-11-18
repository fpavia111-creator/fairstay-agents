// Domain checks: ancillary invoices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewAncillaries } from '../src/logic.js';

const census = [{ resident_id: 'A', payer: 'Medicare A', from: '2026-03-01' }, { resident_id: 'B', payer: 'Lone Star Medicaid', from: '2026-01-01' }];
const L = (o = {}) => ({ vendor: 'Rx Co', vendor_type: o.type ?? 'pharmacy', invoice_no: 'I1', resident_id: o.res ?? 'A', date: o.date ?? '2026-03-05', code: o.code ?? 'X', qty: o.qty ?? 1, amount: o.amount ?? 10 });
const st = (r) => r.items.map((i) => i.status);

test('Part A pharmacy is the facility\'s to pay', () => {
  assert.deepEqual(st(reviewAncillaries([L()], census)), []);
});

test('Medicaid residents: direct-bill services go to the payer, therapy does not', () => {
  assert.deepEqual(st(reviewAncillaries([L({ res: 'B' })], census)), ['bill_payer_instead']);
  assert.deepEqual(st(reviewAncillaries([L({ res: 'B', type: 'therapy' })], census)), []);
});

test('a resident not yet admitted is not in the building', () => {
  assert.deepEqual(st(reviewAncillaries([L({ date: '2026-02-27' }), L({ date: '2026-03-02' })], census)), ['not_in_building']);
});

test('contract rate times quantity', () => {
  const rates = [{ vendor: 'rx co', code: 'x', rate: 5 }];
  assert.deepEqual(st(reviewAncillaries([L({ qty: 2, amount: 10 })], census, rates)), []);
  const r = reviewAncillaries([L({ qty: 2, amount: 12 })], census, rates);
  assert.deepEqual(st(r), ['above_contract']); assert.equal(r.items[0].amount, 2);
});

test('the facility payer list is a setting', () => {
  assert.deepEqual(st(reviewAncillaries([L({ res: 'B' })], census, [], { snfPays: ['medicare_a', 'medicaid'] })), []);
});
