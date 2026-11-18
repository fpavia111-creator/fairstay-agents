// Domain checks: Part A SNF claims.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPartA, hippsProblem, groupLines } from '../src/logic.js';

const L = (claim, o = {}) => ({ claim_id: claim, resident_id: o.res || 'A', from: o.from || '2026-03-01', through: o.through || '2026-03-31', revenue_code: o.rc ?? '0022', hipps: o.hipps ?? 'BCHA1', units: o.units ?? 31, charges: o.charges ?? 100, qs_from: o.qs_from ?? '2026-02-01', qs_to: o.qs_to ?? '2026-02-05', coinsurance_days: o.coins ?? '' });
const st = (r) => r.items.map((i) => i.status);

test('HIPPS shape: each PDPM position has its own letter range; ZZZZZ is the default', () => {
  assert.equal(hippsProblem('PLYF1'), null, 'the last letter of each range is fine');
  assert.deepEqual(['QAAA1', 'AMAA1', 'AAZA1', 'AAAG1', 'AAAAX', 'AAAA', ''].map(hippsProblem), ['invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'invalid', 'missing']);
  assert.equal(hippsProblem('zzzzz'), 'default');
});

test('a clean claim has no findings, and revenue codes are read with leading zeros', () => {
  assert.deepEqual(checkPartA([L('X', { rc: '22' })], { asOf: '2026-04-02' }).items, []);
  assert.equal(groupLines([L('X', { rc: '22' })])[0].lines[0].revenue_code, '0022');
});

test('lines group into claims; claim-level dates may sit on any line', () => {
  const c = groupLines([L('X', { qs_from: '', qs_to: '' }), { ...L('X', { rc: '0420', hipps: '' }), qs_from: '2026-02-01', qs_to: '2026-02-04' }]);
  assert.equal(c.length, 1); assert.equal(c[0].qs_from, '2026-02-01'); assert.equal(c[0].lines.length, 2);
});

test('coinsurance days are benefit days 21-100, counting census days before the claim and earlier days in the period', () => {
  const census = [{ resident_id: 'A', payer: 'Medicare A', from: '2026-02-20' }];
  // 20-28 Feb is 9 days, so March is benefit days 10-40, and days 21-40 are 20 coinsurance days.
  assert.deepEqual(st(checkPartA([L('X', { coins: 20 })], { census, asOf: '2026-04-02' })), []);
  const off = checkPartA([L('X', { coins: 22 })], { census, asOf: '2026-04-02' });
  assert.deepEqual(st(off), ['coinsurance_mismatch']); assert.equal(off.items[0].expected_coinsurance_days, 20);
  const prior = checkPartA([L('X', { coins: 31 })], { census, priorDays: new Map([['A', 30]]), asOf: '2026-04-02' });
  assert.deepEqual(st(prior), [], '30 earlier days make all of March coinsurance days (40-70)');
});

test('the 3-day qualifying stay does not count the discharge day', () => {
  assert.deepEqual(st(checkPartA([L('X', { qs_from: '2026-02-01', qs_to: '2026-02-04' })], { asOf: '2026-04-02' })), []);
  assert.deepEqual(st(checkPartA([L('X', { qs_from: '2026-02-01', qs_to: '2026-02-03' })], { asOf: '2026-04-02' })), ['qualifying_stay_short']);
  assert.deepEqual(st(checkPartA([L('X', { qs_from: '', qs_to: '' })], { asOf: '2026-04-02' })), ['qualifying_stay_missing']);
});

test('days on 0022 lines are summed across payment periods and compared with the census', () => {
  const census = [{ resident_id: 'A', payer: 'Medicare A', from: '2026-03-01' }];
  const two = [L('X', { units: 14, hipps: 'BCHA1' }), L('X', { units: 17, hipps: 'CCHA6' })];
  assert.deepEqual(st(checkPartA(two, { census, asOf: '2026-04-02' })), []);
  const r = checkPartA([L('X', { units: 30 })], { census, asOf: '2026-04-02' });
  assert.deepEqual(st(r), ['days_mismatch']);
});

test('month crossing and future through dates', () => {
  assert.deepEqual(st(checkPartA([L('X', { from: '2026-03-20', through: '2026-04-02', units: 13 })], { asOf: '2026-04-10' })), ['crosses_month']);
  assert.deepEqual(st(checkPartA([L('X')], { asOf: '2026-03-20' })), ['future_through']);
});
