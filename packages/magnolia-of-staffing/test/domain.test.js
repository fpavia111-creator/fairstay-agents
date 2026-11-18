// Domain checks: staffing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longestRnStretch, pbjDue, roleOf, checkStaffing } from '../src/logic.js';

test('RN stretches join touching and overlapping shifts', () => {
  assert.equal(longestRnStretch([{ in: '07:00', out: '11:00' }, { in: '11:00', out: '15:00' }]), 480);
  assert.equal(longestRnStretch([{ in: '07:00', out: '11:00' }, { in: '12:00', out: '20:00' }]), 480);
  assert.equal(longestRnStretch([{ in: '07:00', out: '11:00' }, { in: '11:30', out: '15:00' }]), 240);
  assert.equal(longestRnStretch([{ in: '19:00', out: '07:00' }]), 720);
});

test('PBJ is due 45 days after the quarter', () => {
  assert.deepEqual(pbjDue('2026-02-10'), { quarter_end: '2026-03-31', due: '2026-05-15' });
  assert.deepEqual(pbjDue('2026-12-31'), { quarter_end: '2026-12-31', due: '2027-02-14' });
});

test('roles from job titles', () => {
  assert.deepEqual(['RN Supervisor', 'DON', 'LVN', 'C.N.A.', 'CNA', 'Med Aide', 'Housekeeper'].map(roleOf), ['rn', 'rn', 'lpn', 'cna', 'cna', 'cna', 'other']);
});

test('no census means no hours-per-resident-day finding', () => {
  const r = checkStaffing([{ role: 'RN', date: '2026-03-02', in: '07:00', out: '15:00' }], [], [], { start: '2026-03-02', end: '2026-03-02', asOf: '2026-03-03', targets: { total: 3 } });
  assert.deepEqual(r.items.map((i) => i.status), []);
});
