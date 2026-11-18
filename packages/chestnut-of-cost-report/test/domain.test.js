// Domain checks: patient days tie-out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tieOut } from '../src/logic.js';

const opt = { start: '2025-01-01', end: '2025-01-31', asOf: '2025-03-01' };
const C = [{ resident_id: 'A', payer: 'Medicare A', from: '2025-01-01', to: '2025-01-11' }, { resident_id: 'A', payer: 'Medicaid', from: '2025-01-11' }];
const st = (r) => r.items.map((i) => i.status);

test('days by payer group with the midnight census', () => {
  const r = tieOut(C, [], [], [], opt);
  assert.deepEqual(r.census_days_by_group, { medicare_a: 10, medicaid: 21, other: 0 }); assert.equal(r.total_days, 31);
});

test('a matching cost report is clean, and a total row is optional', () => {
  assert.deepEqual(st(tieOut(C, [{ payer_type: 'medicare_a', days: 10 }, { payer_type: 'medicaid', days: 21 }, { payer_type: 'other', days: 0 }], [], [], opt)), []);
  assert.deepEqual(st(tieOut(C, [{ payer_type: 'Medicare A', days: 11 }, { payer_type: 'medicaid', days: 21 }, { payer_type: 'other', days: 0 }], [], [], opt)), ['total_days_differ', 'days_differ_cost_report']);
});

test('the PS&R is compared with Medicare A days only', () => {
  assert.deepEqual(st(tieOut(C, [], [{ days: 10 }], [], opt)), []);
  assert.deepEqual(st(tieOut(C, [], [{ days: 8 }], [], opt)), ['days_differ_psr']);
});

test('PBC items received are closed', () => {
  assert.deepEqual(st(tieOut([], [], [], [{ item: 'x', due: '2025-02-01', received_on: '2025-02-02' }], opt)), []);
  assert.deepEqual(st(tieOut([], [], [], [{ item: 'x', due: '2025-02-01' }], opt)), ['pbc_overdue']);
});
