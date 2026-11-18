// Domain checks: census against billing, day by day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareCensus, billedDays, periodOf } from '../src/logic.js';

const C = (id, payer, from, to = '', o = {}) => ({ resident_id: id, resident_name: `Res ${id}`, payer, from, to, bed_status: o.bed || 'In House', level: o.level || '' });
const B = (id, payer, from, to, o = {}) => ({ resident_id: id, payer, from, to, days: o.days, amount: o.amount, level: o.level || '' });
const feb = { start: '2026-02-01', end: '2026-02-28' };
const st = (r) => r.items.map((i) => [i.resident_id, i.status, i.days]);

test('the discharge day is not counted; same-day admit and discharge counts one day', () => {
  const r = compareCensus([C('A', 'Medicaid', '2026-02-01', '2026-02-05'), C('B', 'Medicaid', '2026-02-10', '2026-02-10')], [], feb);
  assert.equal(r.census_days, 5);
  assert.deepEqual(st(r), [['A', 'unbilled', 4], ['B', 'unbilled', 1]]);
});

test('billed service dates are inclusive and a clean month has no findings', () => {
  assert.equal(billedDays([B('A', 'Medicaid', '2026-02-01', '2026-02-28')]).length, 28);
  const r = compareCensus([C('A', 'Medicaid', '2026-01-01')], [B('A', 'Medicaid', '2026-02-01', '2026-02-28')], feb);
  assert.deepEqual(r.items, []); assert.equal(r.billable_days, 28);
});

test('payer names match loosely (case, punctuation) but a different payer is wrong_payer', () => {
  const ok = compareCensus([C('A', 'Lone Star Medicaid', '2026-02-01')], [B('A', 'LONE STAR MEDICAID.', '2026-02-01', '2026-02-28')], feb);
  assert.deepEqual(ok.items, []);
  const bad = compareCensus([C('A', 'Medicare A', '2026-02-01')], [B('A', 'Medicaid', '2026-02-01', '2026-02-28')], { ...feb, rates: [{ payer_type: 'medicare_a', rate: 600 }] });
  assert.deepEqual(st(bad), [['A', 'wrong_payer', 28]]); assert.equal(bad.revenue_at_risk, 16800);
});

test('leave days: billable only for bed-hold payers, by name or by payer type', () => {
  const census = [C('A', 'Medicaid', '2026-02-01', '2026-02-05'), C('A', 'Medicaid', '2026-02-05', '2026-02-07', { bed: 'Therapeutic Leave' }), C('A', 'Medicaid', '2026-02-07')];
  const bill = [B('A', 'Medicaid', '2026-02-01', '2026-02-28')];
  assert.deepEqual(st(compareCensus(census, bill, feb)), [['A', 'bed_hold_billed', 2]]);
  assert.deepEqual(compareCensus(census, bill, { ...feb, bedHoldPayers: ['medicaid'] }).items, []);
  const unbilled = compareCensus(census, [B('A', 'Medicaid', '2026-02-01', '2026-02-04'), B('A', 'Medicaid', '2026-02-07', '2026-02-28')], { ...feb, bedHoldPayers: ['Medicaid'] });
  assert.deepEqual(st(unbilled), [['A', 'unbilled', 2]], 'a bed-hold payer\'s leave days must be billed');
});

test('days billed after the last census day are flagged as after discharge', () => {
  const r = compareCensus([C('A', 'Private Pay', '2026-01-01', '2026-02-20')], [B('A', 'Private Pay', '2026-02-01', '2026-02-28')], feb);
  assert.deepEqual(st(r), [['A', 'billed_not_in_census', 9]]); assert.match(r.items[0].message, /last census day/);
});

test('a resident billed with no census at all is billed_not_in_census, not after discharge', () => {
  const r = compareCensus([], [B('Z', 'Medicaid', '2026-02-01', '2026-02-03')], feb);
  assert.deepEqual(st(r), [['Z', 'billed_not_in_census', 3]]); assert.doesNotMatch(r.items[0].message, /last census day/);
});

test('two payers on the same day is a census overlap; the same payer twice is not', () => {
  const r = compareCensus([C('A', 'Medicaid', '2026-02-01'), C('A', 'Medicare A', '2026-02-20')], [B('A', 'Medicaid', '2026-02-01', '2026-02-28')], feb);
  assert.deepEqual(st(r), [['A', 'census_overlap', 9]]);
  assert.deepEqual(compareCensus([C('A', 'Medicaid', '2026-02-01'), C('A', 'Medicaid', '2026-02-10')], [B('A', 'Medicaid', '2026-02-01', '2026-02-28')], feb).items, []);
});

test('duplicates, level and rate differences', () => {
  const rates = [{ payer: 'HMO X', level: 'L1', rate: 400 }, { payer: 'HMO X', level: 'L2', rate: 500 }];
  const r = compareCensus([C('A', 'HMO X', '2026-02-01', '', { level: 'L1' })], [B('A', 'HMO X', '2026-02-01', '2026-02-28', { level: 'L2', days: 28, amount: 14000 }), B('A', 'HMO X', '2026-02-27', '2026-02-28', { level: 'L2', days: 2, amount: 900 })], { ...feb, rates });
  const by = Object.fromEntries(r.items.map((i) => [i.status, i]));
  assert.equal(by.duplicate_billed.days, 2);
  assert.equal(by.level_mismatch.days, 28); assert.equal(by.level_mismatch.amount, 2800);
  assert.equal(by.rate_mismatch.amount, 100, 'second line billed 450 a day against 500');
  assert.equal(r.items.filter((i) => i.status === 'rate_mismatch').length, 1, 'the first line matches its rate');
});

test('runs of days are split when the days are not consecutive', () => {
  const r = compareCensus([C('A', 'Medicaid', '2026-02-01')], [B('A', 'Medicaid', '2026-02-03', '2026-02-10'), B('A', 'Medicaid', '2026-02-15', '2026-02-28')], feb);
  assert.deepEqual(r.items.map((i) => [i.from, i.to, i.days]), [['2026-02-01', '2026-02-02', 2], ['2026-02-11', '2026-02-14', 4]]);
});

test('the period comes from a month or from start and end, and nothing outside it is counted', () => {
  assert.deepEqual(periodOf({ month: '2026-02' }), { start: '2026-02-01', end: '2026-02-28', days: 28 });
  assert.throws(() => periodOf({}), /month/); assert.throws(() => periodOf({ month: '2026-2' }), /YYYY-MM/);
  const r = compareCensus([C('A', 'Medicaid', '2026-01-15')], [B('A', 'Medicaid', '2026-01-15', '2026-03-10')], feb);
  assert.deepEqual(r.items, []); assert.equal(r.billed_days, 28);
});
