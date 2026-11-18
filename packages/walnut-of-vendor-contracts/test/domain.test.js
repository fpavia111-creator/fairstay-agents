// Domain checks: vendor contracts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkVendorContracts } from '../src/logic.js';

const asOf = '2026-04-01';
const K = (o = {}) => ({ vendor: 'V', contract_no: 'C1', start: '2025-01-01', end: o.end ?? '2026-06-30', auto_renew: o.auto ?? 'Y', notice_days: o.notice ?? 60, escalator_pct: o.esc ?? 3 });
const S = (o = {}) => ({ vendor: o.vendor ?? 'V', date: o.date ?? '2026-03-01', amount: o.amount ?? 100, code: o.code ?? '', qty: o.qty ?? 1, unit_price: o.price ?? '' });
const st = (r) => r.items.map((i) => i.status);

test('notice window: inside the warning days only', () => {
  assert.deepEqual(st(checkVendorContracts([K()], [], [], { asOf })), ['notice_window_open']);
  assert.deepEqual(st(checkVendorContracts([K({ end: '2026-12-31' })], [], [], { asOf })), []);
  assert.deepEqual(st(checkVendorContracts([K({ auto: 'N' })], [], [], { asOf })), []);
});

test('an expired contract replaced by a new one is fine', () => {
  const old = K({ end: '2026-01-31', auto: 'N' });
  assert.deepEqual(st(checkVendorContracts([old], [S()], [], { asOf })), ['expired_still_billing']);
  assert.deepEqual(st(checkVendorContracts([old, { ...K({ end: '2027-01-31', auto: 'N' }), start: '2026-02-01' }], [S()], [], { asOf })), []);
});

test('price rise within the escalator is fine', () => {
  const sp = [S({ code: 'X', price: 10, date: '2025-06-01' }), S({ code: 'X', price: 10.3, date: '2026-03-01' })];
  assert.deepEqual(st(checkVendorContracts([K({ end: '2027-12-31' })], sp, [], { asOf })), []);
  assert.deepEqual(st(checkVendorContracts([K({ end: '2027-12-31', esc: 2 })], sp, [], { asOf })), ['price_increase_above_escalator']);
});

test('spend without a contract only above the threshold', () => {
  assert.deepEqual(st(checkVendorContracts([], [S({ amount: 9999 })], [], { asOf })), []);
  assert.deepEqual(st(checkVendorContracts([], [S({ amount: 10000 })], [], { asOf })), ['spend_no_contract']);
});
