// Domain checks: managed care claims against contracts and authorizations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkManagedCare } from '../src/logic.js';

const rates = [{ payer: 'Plan X', level: 'L1', rate: 400 }, { payer: 'Plan X', level: 'L2', rate: 500, from: '2026-01-01' }, { payer: 'Plan X', level: 'L2', rate: 450, to: '2025-12-31' }];
const auths = [{ auth_number: 'A-1', resident_id: 'R', payer: 'Plan X', level: 'L2', from: '2026-03-01', to: '2026-03-31' }];
const C = (o = {}) => ({ claim_id: 'C', resident_id: 'R', payer: 'Plan X', level: o.level ?? 'L2', from: o.from ?? '2026-03-01', through: o.through ?? '2026-03-10', days: o.days, billed: o.billed ?? 5000, paid: o.paid ?? '', auth_number: o.auth ?? 'A-1' });
const st = (r) => r.items.map((i) => [i.status, i.amount]);

test('a clean claim; rates by effective date', () => {
  assert.deepEqual(checkManagedCare([C()], rates, auths).items, []);
  const old = checkManagedCare([C({ from: '2025-12-01', through: '2025-12-10', billed: 4500 })], rates, [{ ...auths[0], from: '2025-12-01' }]);
  assert.deepEqual(old.items, [], '2025 rate is 450');
});

test('days come from the dates when the days column is empty', () => {
  const r = checkManagedCare([C({ billed: 4000 })], rates, auths);
  assert.deepEqual(st(r), [['billed_below_contract', 1000]]);
});

test('paid below the lesser of billed and contract is an underpayment', () => {
  assert.deepEqual(st(checkManagedCare([C({ billed: 6000, paid: 4800 })], rates, auths)), [['paid_below_contract', 200]]);
  assert.deepEqual(checkManagedCare([C({ billed: 5000, paid: 5000 })], rates, auths).items, []);
});

test('authorization numbers match without dashes or case; other residents\' numbers do not count', () => {
  assert.deepEqual(checkManagedCare([C({ auth: 'a1' })], rates, auths).items, []);
  assert.deepEqual(st(checkManagedCare([{ ...C(), resident_id: 'Q' }], rates, auths)), [['auth_not_found', 0]]);
  assert.deepEqual(st(checkManagedCare([C({ auth: '' })], rates, auths)), [['no_auth_number', 0]]);
});

test('days outside the authorization and an unauthorized level are priced at the contract rate', () => {
  const r = checkManagedCare([C({ from: '2026-03-25', through: '2026-04-03', billed: 5000 })], rates, auths);
  assert.deepEqual(st(r), [['days_beyond_auth', 1500]]);
  const lv = checkManagedCare([C({ level: 'L1', billed: 4000 })], rates, auths);
  assert.deepEqual(st(lv), [['level_not_authorized', 0]], 'billing a lower level than authorized costs nothing extra');
});

test('no rate for a level is reported and does not stop the authorization checks', () => {
  const r = checkManagedCare([C({ level: 'L9', auth: '' })], rates, auths);
  assert.deepEqual(r.items.map((i) => i.status), ['no_auth_number', 'no_contract_rate']);
});
