// Domain checks: payables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPayables } from '../src/logic.js';

const asOf = '2026-03-31';
const V = [{ vendor: 'Linen Co', approved: 'Y', bank_account: '111-222' }, { vendor: 'Power Co', approved: 'Y', no_po: 'Y' }];
const I = (o = {}) => ({ vendor: o.vendor ?? 'Linen Co', invoice_no: o.no ?? 'A1', invoice_date: o.date ?? '2026-03-01', due_date: o.due ?? '2026-04-30', amount: o.amount ?? 500, po_number: o.po ?? '', paid_on: o.paid ?? '', bank_account: o.bank ?? '111222' });
const st = (r) => r.items.map((i) => i.status);

test('bank accounts compare on digits only', () => {
  assert.deepEqual(st(checkPayables([I()], V, [], { asOf })), []);
  assert.deepEqual(st(checkPayables([I({ bank: '999-222' })], V, [], { asOf })), ['bank_account_changed']);
});

test('duplicates: same invoice number, or same amount and date', () => {
  assert.deepEqual(st(checkPayables([I(), I({ no: 'a-1' })], V, [], { asOf })), ['duplicate_invoice']);
  assert.deepEqual(st(checkPayables([I(), I({ no: 'B2' })], V, [], { asOf })), ['duplicate_invoice']);
  assert.deepEqual(st(checkPayables([I(), I({ no: 'B2', amount: 501 })], V, [], { asOf })), []);
});

test('PO rules: threshold, exempt vendors and the tolerance', () => {
  assert.deepEqual(st(checkPayables([I({ amount: 1500 })], V, [], { asOf })), ['missing_po']);
  assert.deepEqual(st(checkPayables([I({ vendor: 'Power Co', amount: 1500, bank: '' })], V, [], { asOf })), []);
  const pos = [{ po_number: 'P1', amount: 1000 }];
  assert.deepEqual(st(checkPayables([I({ amount: 1040, po: 'p-1' })], V, pos, { asOf })), []);
  assert.deepEqual(st(checkPayables([I({ amount: 1060, po: 'P1' })], V, pos, { asOf })), ['over_po']);
});

test('paid invoices are never past due', () => {
  assert.deepEqual(st(checkPayables([I({ due: '2026-03-01' })], V, [], { asOf })), ['past_due']);
  assert.deepEqual(st(checkPayables([I({ due: '2026-03-01', paid: '2026-03-02' })], V, [], { asOf })), []);
});
