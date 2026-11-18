// Domain checks: eligibility, Part A benefit days and the qualifying stay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEligibility, eligStatus, inpatientDays } from '../src/logic.js';

const C = (id, payer, from, to = '') => ({ resident_id: id, resident_name: `Res ${id}`, payer, from, to });
const E = (id, payer, o = {}) => ({ resident_id: id, payer, status: o.status ?? 'Active', checked_on: o.checked ?? '2026-03-01', coverage_to: o.to ?? '', part_a_days_used: o.used ?? '', renewal_date: o.renewal ?? '' });
const S = (id, admit, dis, snf, waiver = '') => ({ resident_id: id, hospital_admit: admit, hospital_discharge: dis, snf_admit: snf, waiver });
const st = (r) => r.items.map((i) => i.status);
const asOf = '2026-03-02';

test('status words: "Not eligible" and "Terminated" are inactive; a blank or unknown word is never active', () => {
  assert.deepEqual(['Active', 'Eligible', 'Not eligible', 'Terminated', 'Coverage lapsed', '', 'see notes'].map(eligStatus), ['active', 'active', 'inactive', 'inactive', 'inactive', 'unknown', 'unknown']);
});

test('the qualifying stay counts inpatient days without the discharge day', () => {
  assert.equal(inpatientDays('2026-01-01', '2026-01-04'), 3);
  assert.equal(inpatientDays('2026-01-01', '2026-01-03'), 2);
  const r = checkEligibility([C('A', 'Medicare A', '2026-02-20')], [E('A', 'Medicare A')], [S('A', '2026-02-16', '2026-02-19', '2026-02-20')], { asOf });
  assert.deepEqual(st(r), []);
  const short = checkEligibility([C('A', 'Medicare A', '2026-02-20')], [E('A', 'Medicare A')], [S('A', '2026-02-17', '2026-02-19', '2026-02-20')], { asOf });
  assert.deepEqual(st(short), ['short_qualifying_stay']);
});

test('admission within 30 days of the hospital discharge is fine; 31 days is late; a waiver skips both', () => {
  const run = (snf, w) => st(checkEligibility([C('A', 'Medicare A', snf)], [E('A', 'Medicare A')], [S('A', '2026-01-01', '2026-01-05', snf, w)], { asOf }));
  assert.deepEqual(run('2026-02-04'), []);
  assert.deepEqual(run('2026-02-05'), ['late_admission']);
  assert.deepEqual(run('2026-02-05', 'Yes'), []);
});

test('Part A days: earlier days in the benefit period plus this stay, warning and exhausted', () => {
  const s = [S('A', '2025-11-01', '2025-11-05', '2025-11-25')];
  const r = checkEligibility([C('A', 'Medicare A', '2025-11-25')], [E('A', 'Medicare A', { used: 10 })], s, { asOf, warnDays: 14 });
  assert.deepEqual(st(r), ['benefit_exhausted'], '10 earlier + 98 this stay is past 100');
  const w = checkEligibility([C('A', 'Medicare A', '2026-01-01')], [E('A', 'Medicare A', { used: 30 })], [S('A', '2025-12-25', '2025-12-29', '2026-01-01')], { asOf, warnDays: 14 });
  assert.equal(w.items[0].status, 'benefit_ending'); assert.equal(w.items[0].days_left, 9);
});

test('coverage that ended but is still on the census is the top finding; ending soon is a warning', () => {
  const r = checkEligibility([C('A', 'Medicaid', '2025-01-01'), C('B', 'Medicaid', '2025-01-01')], [E('A', 'Medicaid', { to: '2026-02-28' }), E('B', 'Medicaid', { to: '2026-03-10' })], [], { asOf });
  assert.deepEqual(r.items.map((i) => [i.resident_id, i.status]), [['A', 'coverage_ended'], ['B', 'coverage_ending']]);
});

test('stale and missing checks; the newest check per resident and payer is used', () => {
  const r = checkEligibility([C('A', 'Medicaid', '2025-01-01'), C('B', 'Medicaid', '2025-01-01')], [E('A', 'Medicaid', { checked: '2025-12-01' }), E('A', 'Medicaid', { checked: '2026-02-25' })], [], { asOf, staleDays: 30 });
  assert.deepEqual(r.items.map((i) => [i.resident_id, i.status]), [['B', 'no_check']]);
  const old = checkEligibility([C('A', 'Medicaid', '2025-01-01')], [E('A', 'Medicaid', { checked: '2026-01-15' })], [], { asOf, staleDays: 30 });
  assert.equal(old.items[0].status, 'stale_check'); assert.equal(old.items[0].days_since_check, 46);
});

test('Medicaid renewals: due within the warning window, overdue after the date', () => {
  const r = checkEligibility([C('A', 'Medicaid', '2025-01-01'), C('B', 'Medicaid', '2025-01-01')], [E('A', 'Medicaid', { renewal: '2026-03-20' }), E('B', 'Medicaid', { renewal: '2026-02-20' })], [], { asOf });
  assert.deepEqual(r.items.map((i) => [i.resident_id, i.status]).sort(), [['A', 'renewal_due'], ['B', 'renewal_overdue']]);
});

test('private pay and discharged residents are not checked', () => {
  const r = checkEligibility([C('A', 'Private Pay', '2025-01-01'), C('B', 'Medicaid', '2025-01-01', '2026-02-01')], [], [], { asOf });
  assert.equal(r.residents, 1); assert.deepEqual(r.items, []);
});
