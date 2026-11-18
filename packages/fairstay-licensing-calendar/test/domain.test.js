// Domain checks: licensing calendar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLicensing, STANDARD_ITEMS } from '../src/logic.js';

const asOf = '2026-04-01';
const st = (r) => r.items.map((i) => i.status);
const full = (f = 'F') => STANDARD_ITEMS.map((s) => ({ item: s.name, facility: f, expires: '2027-12-31' }));

test('a facility with every standard item, all current, is clean', () => {
  assert.deepEqual(st(checkLicensing(full(), [], { asOf, facilities: ['F'] })), []);
});

test('each standard item name matches its own pattern', () => {
  for (const s of STANDARD_ITEMS) assert.ok(s.match.test(s.name), s.key);
});

test('expired, pending and expiring by date and renewal filed; the warning is a setting', () => {
  const one = (o, w) => st(checkLicensing([{ item: 'RN license', holder: 'A B', role: 'RN', ...o }], [], { asOf, warnDays: w }));
  assert.deepEqual(one({ expires: '2026-03-31' }), ['expired']);
  assert.deepEqual(one({ expires: '2026-03-31', renewal_filed: '2026-03-01' }), ['renewal_pending_past_expiry']);
  assert.deepEqual(one({ expires: '2026-05-31' }), ['expiring']);
  assert.deepEqual(one({ expires: '2026-05-31', renewal_filed: '2026-03-01' }), []);
  assert.deepEqual(one({ expires: '2026-06-01' }), []);
  assert.deepEqual(one({ expires: '2026-06-01' }, 90), ['expiring']);
  assert.deepEqual(one({ expires: '2026-04-01' }), ['expiring']);
});

test('licensed staff need a license row; dots and case in the role do not matter; other roles are skipped', () => {
  const lic = [{ item: 'RN license', holder: 'Ana Ruiz', expires: '2027-01-01' }];
  assert.deepEqual(st(checkLicensing(lic, [{ name: 'ana ruiz', role: 'r.n.' }], { asOf })), []);
  assert.deepEqual(st(checkLicensing(lic, [{ name: 'Bo Lee', role: 'l.p.n.' }], { asOf })), ['staff_license_missing']);
  assert.deepEqual(st(checkLicensing(lic, [{ name: 'Bo Lee', role: 'Housekeeper' }], { asOf })), []);
});

test('missing standard items only for facilities named or holding a facility item', () => {
  assert.deepEqual(st(checkLicensing([{ item: 'RN license', holder: 'A', facility: 'F', expires: '2027-01-01' }], [], { asOf })), []);
  const r = checkLicensing(full().filter((x) => !/Food/.test(x.item)), [], { asOf });
  assert.deepEqual(r.items.map((i) => i.standard), ['food_permit']);
});
