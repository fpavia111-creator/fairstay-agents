// Domain checks: one proper payer per resident day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPayerSource } from '../src/logic.js';

const C = (id, payer, from, to = '') => ({ resident_id: id, resident_name: `Res ${id}`, payer, from, to });
const mar = { start: '2026-03-01', end: '2026-03-31' };
const st = (r) => r.items.map((i) => [i.resident_id, i.status, i.days]);

test('a clean month has no findings', () => {
  const r = checkPayerSource([C('A', 'Medicaid', '2025-01-01')], { ...mar, residents: [{ resident_id: 'A' }] });
  assert.deepEqual(r.items, []); assert.equal(r.resident_days, 31);
});

test('Part A day numbers count from the earlier days in the benefit period and from before the month', () => {
  const r = checkPayerSource([C('A', 'Medicare A', '2026-02-01')], { ...mar, residents: [{ resident_id: 'A', part_a_days_used: 50, secondary_payer: 'Medicaid' }] });
  // Feb has 28 Part A days -> day 78 on 28 Feb; 1 March is day 79, day 100 is 22 March.
  assert.deepEqual(st(r), [['A', 'part_a_over_100', 9]]); assert.equal(r.items[0].from, '2026-03-23');
});

test('coinsurance days 21-100 need a secondary payer; with one there is no finding', () => {
  const none = checkPayerSource([C('A', 'Medicare A', '2026-03-01')], { ...mar, coinsuranceRate: 100 });
  assert.deepEqual(st(none), [['A', 'coinsurance_no_secondary', 11]]); assert.equal(none.items[0].amount, 1100); assert.equal(none.items[0].from, '2026-03-21');
  assert.deepEqual(checkPayerSource([C('A', 'Medicare A', '2026-03-01')], { ...mar, residents: [{ resident_id: 'A', secondary_payer: 'Medicaid' }] }).items, []);
});

test('a blank payer is no_payer and is not also reported as unknown', () => {
  const r = checkPayerSource([C('A', '', '2026-03-01', '2026-03-03'), C('A', 'Medicaid', '2026-03-03')], { ...mar, payers: [{ name: 'Medicaid' }] });
  assert.deepEqual(st(r), [['A', 'no_payer', 2]]);
});

test('payer list matching ignores case and punctuation; a different name is unknown', () => {
  assert.deepEqual(checkPayerSource([C('A', 'medicaid.', '2026-03-01')], { ...mar, payers: [{ name: 'Medicaid' }] }).items, []);
  assert.deepEqual(st(checkPayerSource([C('A', 'Medicaid TX', '2026-03-01')], { ...mar, payers: [{ name: 'Medicaid' }] })), [['A', 'unknown_payer', 31]]);
});

test('two payers on one day overlap; the same payer split into two rows does not', () => {
  assert.deepEqual(st(checkPayerSource([C('A', 'Medicaid', '2026-03-01'), C('A', 'Private Pay', '2026-03-30')], mar)).filter((x) => x[1] === 'payer_overlap'), [['A', 'payer_overlap', 2]]);
  assert.deepEqual(checkPayerSource([C('A', 'Medicaid', '2026-03-01', '2026-03-15'), C('A', 'Medicaid', '2026-03-15')], mar).items, []);
});

test('hospice on Part A, private pay with no guarantor', () => {
  const r = checkPayerSource([C('A', 'Medicare A', '2026-03-25'), C('B', 'Private Pay', '2026-03-30')], { ...mar, residents: [{ resident_id: 'A', hospice_agency: 'Hospice X', secondary_payer: 'S' }, { resident_id: 'B' }] });
  assert.deepEqual(st(r), [['A', 'hospice_on_part_a', 7], ['B', 'private_no_guarantor', 2]]);
});
