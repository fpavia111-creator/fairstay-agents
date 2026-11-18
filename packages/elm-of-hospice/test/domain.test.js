// Domain checks: hospice room and board.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHospice } from '../src/logic.js';

const month = '2026-03'; const asOf = '2026-04-20';
const H = 'Bluebonnet Hospice';
const census = (o = {}) => [{ resident_id: 'A', payer: 'Medicaid', hospice: o.hospice ?? H, from: o.from ?? '2026-03-01', to: o.to ?? '', bed_status: o.bed ?? '' }];
const inv = (o = {}) => ({ resident_id: 'A', hospice: H, from: o.from ?? '2026-03-01', to: o.to ?? '2026-03-31', amount: o.amount ?? 6045, invoice_date: o.date ?? '2026-04-02', paid_amount: o.paid ?? '' });
const contracts = [{ hospice: H, rate: 195 }];
const st = (r) => r.items.map((i) => i.status);

test('a full month invoiced at the contract rate is clean', () => {
  assert.deepEqual(st(checkHospice(census(), [inv()], contracts, [], { month, asOf })), []);
});

test('a hospice payer row counts as a hospice day even without a hospice column', () => {
  const r = checkHospice([{ resident_id: 'A', payer: 'Bluebonnet Hospice', from: '2026-03-01' }], [inv()], contracts, [], { month, asOf });
  assert.equal(r.hospice_days, 31); assert.deepEqual(st(r), []);
});

test('the discharge day is not a hospice day, and hospital days are not invoiced', () => {
  const r = checkHospice(census({ to: '2026-03-11' }), [inv({ to: '2026-03-10', amount: 1950 })], contracts, [], { month, asOf });
  assert.deepEqual(st(r), []);
  const hosp = checkHospice([...census({ to: '2026-03-11' }), { resident_id: 'A', payer: 'Medicaid', hospice: H, from: '2026-03-11', bed_status: 'Hospital leave' }], [inv({ to: '2026-03-10', amount: 1950 })], contracts, [], { month, asOf });
  assert.deepEqual(st(hosp), []);
});

test('unpaid follows contract terms, not the default', () => {
  const late = checkHospice(census(), [inv({ date: '2026-03-01' })], [{ hospice: H, rate: 195, pay_days: 60 }], [], { month, asOf });
  assert.deepEqual(st(late), []);
  assert.deepEqual(st(checkHospice(census(), [inv({ date: '2026-03-01' })], contracts, [], { month, asOf })), ['unpaid']);
});

test('only Medicaid claims count as billing Medicaid directly', () => {
  assert.deepEqual(st(checkHospice(census(), [inv()], contracts, [{ resident_id: 'A', payer: 'Medicare B', from: '2026-03-02' }], { month, asOf })), []);
  const r = checkHospice(census(), [inv()], contracts, [{ resident_id: 'A', payer: 'Lone Star Medicaid', from: '2026-03-02', to: '2026-03-03' }], { month, asOf });
  assert.deepEqual(st(r), ['medicaid_billed_directly']); assert.equal(r.items[0].days, 2);
});
