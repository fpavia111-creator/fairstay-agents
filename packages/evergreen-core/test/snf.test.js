// evergreen-core: the nursing-home helpers every Evergreen agent builds on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payerType, bedStatus, rowDays, censusDays, monthBounds, agingBucket, idKey, yes, listOf, dayRuns, dateRange, rateFor, sortByStatus, countBy, total } from '../src/index.js';

test('payer type: Medicare Advantage and HMO plans are managed care, never Medicare A', () => {
  assert.equal(payerType('Humana Medicare Advantage'), 'managed_care');
  assert.equal(payerType('Sunrise Advantage HMO (fictional)'), 'managed_care');
  assert.equal(payerType('Medicare'), 'medicare_a');
  assert.equal(payerType('Medicare Part B'), 'medicare_b');
});

test('payer type: an explicit type column wins, pending Medicaid is its own type, unknown names stay unknown', () => {
  assert.equal(payerType('Anything at all', 'Medicaid'), 'medicaid');
  assert.equal(payerType('Whatever', 'part a'), 'medicare_a');
  assert.equal(payerType('Texas Medicaid Pending'), 'medicaid_pending');
  assert.equal(payerType('Hospice of the Hills'), 'hospice');
  assert.equal(payerType('Resident pay'), 'private');
  assert.equal(payerType(''), 'unknown');
  assert.equal(payerType('Acme Widgets'), 'unknown');
});

test('bed status in everyday words', () => {
  assert.equal(bedStatus(''), 'in_house');
  assert.equal(bedStatus('Hospital leave'), 'hospital');
  assert.equal(bedStatus('Bed hold'), 'hospital');
  assert.equal(bedStatus('Therapeutic leave'), 'leave');
  assert.equal(bedStatus('Discharged'), 'discharged');
});

test('census row days: the discharge day is not a census day, an open stay runs to the end, start clamps', () => {
  assert.deepEqual(rowDays({ from: '2026-03-01', to: '2026-03-04' }), ['2026-03-01', '2026-03-02', '2026-03-03']);
  assert.deepEqual(rowDays({ from: '2026-03-01', to: '' }, '2026-03-02', '2026-03-03'), ['2026-03-02', '2026-03-03']);
  assert.deepEqual(rowDays({ from: '2026-03-05', to: '2026-03-05' }), ['2026-03-05']);
  assert.deepEqual(rowDays({ from: '' }), []);
});

test('censusDays keeps both rows when a resident has two on the same day (an overlap is a finding)', () => {
  const days = censusDays([{ resident_id: 'R1', from: '2026-03-01', payer: 'Medicare' }, { resident_id: 'R1', from: '2026-03-01', payer: 'Medicaid' }], '2026-03-01', '2026-03-01');
  assert.equal(days.length, 2);
  assert.deepEqual(days.map((d) => d.payer_type).sort(), ['medicaid', 'medicare_a']);
});

test('month bounds know leap years and refuse other shapes', () => {
  assert.deepEqual(monthBounds('2028-02'), { start: '2028-02-01', end: '2028-02-29', days: 29 });
  assert.deepEqual(monthBounds('2026-02'), { start: '2026-02-01', end: '2026-02-28', days: 28 });
  assert.equal(monthBounds('2026-2'), null);
});

test('aging buckets', () => {
  assert.equal(agingBucket(0), '0-30');
  assert.equal(agingBucket(31), '31-60');
  assert.equal(agingBucket(400), '365+');
  assert.equal(agingBucket(-1), 'future');
  assert.equal(agingBucket(null), 'unknown');
});

test('ids match across punctuation, case and leading zeros', () => {
  assert.equal(idKey('inv-00042'), idKey('INV 00042'));
  assert.equal(idKey('inv-00042'), 'INV00042');
  assert.equal(idKey('00042'), '42');
  assert.equal(idKey('a-1/b'), 'A1B');
});

test('yes words and lists', () => {
  for (const v of ['Y', 'yes', 'TRUE', '1', 'x', 'done']) assert.ok(yes(v), v);
  for (const v of ['', 'no', 'n', '0', 'maybe']) assert.ok(!yes(v), v);
  assert.deepEqual(listOf('Bank statements; Deed | Pension letter,  '), ['Bank statements', 'Deed', 'Pension letter']);
});

test('dayRuns: consecutive days merge, a gap starts a new run, a second row on the same day is kept but not counted twice', () => {
  const d = (date, k = 'A') => ({ k, date });
  const runs = dayRuns([d('2026-03-03'), d('2026-03-01'), d('2026-03-02'), d('2026-03-02'), d('2026-03-05'), d('2026-03-01', 'B')], (x) => x.k);
  assert.deepEqual(runs.map((r) => [r.key, r.from, r.to, r.days, r.items.length]), [['A', '2026-03-01', '2026-03-03', 3, 4], ['A', '2026-03-05', '2026-03-05', 1, 1], ['B', '2026-03-01', '2026-03-01', 1, 1]]);
});

test('date ranges are inclusive and capped', () => {
  assert.deepEqual(dateRange('2026-02-27', '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.deepEqual(dateRange('2026-03-01', ''), ['2026-03-01']);
  assert.equal(dateRange('2000-01-01', '2030-01-01', 10).length, 10);
});

test('rateFor: the most specific row wins (payer, then level, then payer type), inside its dates', () => {
  const rates = [
    { level: '', rate: 200 },
    { payer: 'Lone Star Medicaid', rate: 210 },
    { payer: 'Lone Star Medicaid', level: 'SKILLED', rate: 250, from: '2026-01-01', to: '2026-06-30' },
    { payer: 'Lone Star Medicaid', level: 'SKILLED', rate: 260, from: '2026-07-01' },
  ];
  assert.equal(rateFor(rates, { payer: 'Lone Star Medicaid', level: 'skilled', date: '2026-03-01' }), 250);
  assert.equal(rateFor(rates, { payer: 'LONE STAR MEDICAID', level: 'SKILLED', date: '2026-08-01' }), 260);
  assert.equal(rateFor(rates, { payer: 'Lone Star Medicaid', level: 'CUSTODIAL', date: '2026-03-01' }), 210);
  assert.equal(rateFor(rates, { payer: 'Other Plan', level: 'SKILLED', date: '2026-03-01' }), 200);
  assert.equal(rateFor([{ payer: 'X', rate: 1 }], { payer: 'Y' }), null);
});

test('sortByStatus orders by status, then the larger amount, then resident; countBy and total', () => {
  const items = [{ status: 'b', amount: 5, resident_id: 'R2' }, { status: 'a', amount: 1, resident_id: 'R9' }, { status: 'b', amount: 9, resident_id: 'R1' }, { status: 'b', amount: 5, resident_id: 'R1' }];
  assert.deepEqual(sortByStatus(items, { a: 0, b: 1 }).map((i) => `${i.status}${i.amount}${i.resident_id}`), ['a1R9', 'b9R1', 'b5R1', 'b5R2']);
  assert.deepEqual(countBy(items, 'status'), { a: 1, b: 3 });
  assert.equal(total([{ x: 0.1 }, { x: 0.2 }], 'x'), 0.3);
});
