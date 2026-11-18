// Domain checks: Part B therapy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPartB, unitsFor8MinuteRule } from '../src/logic.js';

const L = (o = {}) => ({ resident_id: o.res ?? 'A', date: o.date ?? '2026-03-02', cpt: o.cpt ?? '97110', modifiers: o.mods ?? 'GP', minutes: o.min ?? 30, units: o.units ?? 2, charge: o.charge ?? 90, allowed: o.allowed ?? 60 });
const st = (r) => r.items.map((i) => i.status);

test('8-minute rule boundaries', () => {
  assert.deepEqual([0, 7, 8, 22, 23, 37, 38, 52, 53, 67, 68].map(unitsFor8MinuteRule), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
});

test('timed minutes are added across codes on the same day', () => {
  // 20 + 20 minutes = 40 -> 3 units; billing 2 + 2 is one too many.
  const r = checkPartB([L({ min: 20, units: 2 }), L({ cpt: '97140', min: 20, units: 2 })]);
  assert.deepEqual(st(r), ['units_over_8_minute_rule']); assert.equal(r.items[0].units_allowed, 3);
  assert.deepEqual(checkPartB([L({ min: 20, units: 1 }), L({ cpt: '97140', min: 20, units: 2 })]).items, []);
});

test('lines without minutes are not judged by the 8-minute rule', () => {
  assert.deepEqual(checkPartB([L({ min: '', units: 4 })]).items, []);
});

test('modifiers can be in one cell separated by spaces or commas', () => {
  assert.deepEqual(checkPartB([L({ mods: 'KX GP' })]).items, []);
  assert.deepEqual(checkPartB([L({ mods: 'KX,GO' })]).items, []);
  assert.deepEqual(st(checkPartB([L({ mods: '59' })])), ['missing_discipline_modifier']);
});

test('KX: PT and speech share one threshold, OT has its own, and KX on the line clears it', () => {
  const lines = [L({ date: '2026-01-05', allowed: 1000 }), L({ date: '2026-02-05', cpt: '92507', mods: 'GN', min: '', allowed: 1000 }), L({ date: '2026-03-05', allowed: 500 }), L({ date: '2026-03-06', cpt: '97530', mods: 'GO', allowed: 500 })];
  const r = checkPartB(lines, { kxThresholds: { pt_slp: 2400, ot: 2400 } });
  assert.deepEqual(r.items.map((i) => [i.status, i.date]), [['kx_needed', '2026-03-05']]);
  assert.deepEqual(checkPartB([...lines.slice(0, 2), L({ date: '2026-03-05', allowed: 500, mods: 'GP KX' })], { kxThresholds: { pt_slp: 2400 } }).items, []);
});

test('Part B therapy on a Part A day; a new calendar year starts the KX total again', () => {
  const census = [{ resident_id: 'A', payer: 'Medicare A', from: '2026-03-01', to: '2026-03-05' }];
  assert.deepEqual(checkPartB([L({ date: '2026-03-04' }), L({ date: '2026-03-05', cpt: '97140' })], { census }).items.map((i) => [i.status, i.date]), [['part_a_overlap', '2026-03-04']], 'the discharge day is not a Part A day');
  assert.deepEqual(checkPartB([L({ date: '2025-12-30', allowed: 2000 }), L({ date: '2026-01-02', allowed: 2000 })], { kxThresholds: { pt_slp: 2400 } }).items, []);
});

test('duplicates are found; a second line with a different modifier is not a duplicate', () => {
  assert.deepEqual(st(checkPartB([L({ min: 60, units: 2 }), L({ min: 0, units: 2 })])), ['duplicate_line']);
  assert.deepEqual(checkPartB([L({ min: 30, units: 2 }), L({ mods: 'GP 59', min: 30, units: 2 })]).items, []);
});
