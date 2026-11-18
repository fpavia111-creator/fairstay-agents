// Domain checks: change of ownership tracker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackChow, STANDARD_STEPS } from '../src/logic.js';

const asOf = '2026-04-01'; const closeDate = '2026-07-01';
const st = (r) => r.items.filter((i) => i.status !== 'missing_standard_step').map((i) => i.status);
const all = STANDARD_STEPS.map((s) => ({ step: s.name, done_on: '2026-03-01' }));

test('a complete list of done standard steps has nothing open', () => {
  const r = trackChow(all, { asOf, closeDate });
  assert.equal(r.items.length, 0);
  assert.equal(r.done, STANDARD_STEPS.length);
});

test('each standard step name matches its own pattern', () => {
  for (const s of STANDARD_STEPS) assert.ok(s.match.test(s.name), s.key);
});

test('days before close turns into a due date', () => {
  const r = trackChow([{ step: 'X', days_before_close: 30 }], { asOf, closeDate });
  assert.equal(r.items.find((i) => i.step === 'X').due, '2026-06-01');
});

test('late, due soon and open by days left; the warn window is a setting', () => {
  assert.deepEqual(st(trackChow([{ step: 'A', due: '2026-03-31' }], { asOf, closeDate })), ['late']);
  assert.deepEqual(st(trackChow([{ step: 'A', due: '2026-04-15' }], { asOf, closeDate })), ['due_soon']);
  assert.deepEqual(st(trackChow([{ step: 'A', due: '2026-04-16' }], { asOf, closeDate })), ['open']);
  assert.deepEqual(st(trackChow([{ step: 'A', due: '2026-04-16' }], { asOf, closeDate, warnDays: 30 })), ['due_soon']);
});

test('blocked only while the blocking step is not done, and blocked wins over late', () => {
  const rows = (doneB) => [{ step: 'B', done_on: doneB }, { step: 'A', due: '2026-03-01', blocked_by: 'b' }];
  assert.deepEqual(st(trackChow(rows(''), { asOf, closeDate })), ['blocked', 'open']);
  assert.deepEqual(st(trackChow(rows('2026-03-01'), { asOf, closeDate })), ['late']);
});

test('a step with no due date is open and asks for one', () => {
  const r = { items: trackChow([{ step: 'A' }], { asOf, closeDate }).items.filter((i) => i.step === 'A') };
  assert.equal(r.items[0].status, 'open'); assert.match(r.items[0].fix, /due date/);
});

test('a missing standard step is flagged once, with a typical date from the closing', () => {
  const r = trackChow(all.filter((s) => !/CLIA/.test(s.step)), { asOf, closeDate });
  assert.deepEqual(r.items.map((i) => i.standard), ['clia']);
  assert.equal(r.items[0].due, '2026-06-01');
});
