// Domain checks: authorizations against the census.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAuthorizations } from '../src/logic.js';

const P = 'Sunrise Advantage HMO';
const C = (o = {}) => [{ resident_id: 'A', payer: o.payer ?? P, level: o.level ?? 'SKILLED', from: o.from ?? '2026-03-01', to: o.to ?? '', bed_status: o.bed ?? '' }];
const Au = (o = {}) => ({ resident_id: 'A', payer: o.payer ?? P, auth_number: o.no ?? 'X1', from: o.from ?? '2026-03-01', to: o.to ?? '2026-03-31', level: o.level ?? 'SKILLED', days_authorized: o.days ?? '', next_review: o.review ?? '' });
const st = (r) => r.items.map((i) => i.status);
const opt = { start: '2026-03-01', asOf: '2026-03-10' };

test('covered days are clean, and leave days need no authorization', () => {
  assert.deepEqual(st(checkAuthorizations(C(), [Au()], opt)), []);
  assert.deepEqual(st(checkAuthorizations([...C({ to: '2026-03-05' }), { resident_id: 'A', payer: P, from: '2026-03-05', bed_status: 'Hospital leave' }], [Au({ to: '2026-03-04' })], opt)), []);
});

test('an authorization for another plan does not cover the day', () => {
  const r = checkAuthorizations(C(), [Au({ payer: 'Gulf Coast HMO' })], opt);
  assert.deepEqual(st(r), ['no_auth']); assert.equal(r.items[0].days, 10);
});

test('days authorized are counted in date order', () => {
  const r = checkAuthorizations(C(), [Au({ days: 7 })], opt);
  assert.deepEqual(st(r), ['over_authorized_days']); assert.equal(r.items[0].from, '2026-03-08'); assert.equal(r.items[0].days, 3);
});

test('levels compare without case', () => {
  assert.deepEqual(st(checkAuthorizations(C({ level: 'skilled' }), [Au()], opt)), []);
});

test('an authorization ending is quiet when the next one starts the day after', () => {
  assert.deepEqual(st(checkAuthorizations(C(), [Au({ to: '2026-03-11' })], opt)), ['auth_ending']);
  assert.deepEqual(st(checkAuthorizations(C(), [Au({ to: '2026-03-11' }), Au({ no: 'X2', from: '2026-03-12' })], opt)), []);
});

test('reviews: due soon and overdue', () => {
  assert.deepEqual(st(checkAuthorizations(C(), [Au({ review: '2026-03-11' })], opt)), ['review_due']);
  assert.deepEqual(st(checkAuthorizations(C(), [Au({ review: '2026-03-09' })], opt)), ['review_overdue']);
  assert.deepEqual(st(checkAuthorizations(C(), [Au({ review: '2026-03-20' })], opt)), []);
});
