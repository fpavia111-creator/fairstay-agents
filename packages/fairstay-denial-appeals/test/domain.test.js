// Domain checks: appeal deadlines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAppeals } from '../src/logic.js';

const asOf = '2026-04-15';
const D = (o = {}) => ({ resident_id: 'A', payer: o.payer ?? 'Medicare A', claim_id: 'X', amount: 100, denied_on: o.denied ?? '2026-03-01', level: o.level ?? '', filed_on: o.filed ?? '', decided_on: o.decided ?? '', decision: o.decision ?? '' });
const st = (r) => r.items.map((i) => i.status);

test('Medicare level 1 is 120 days from the denial', () => {
  const r = checkAppeals([D({ denied: '2025-12-20' })], { asOf });
  assert.equal(r.items[0].deadline, '2026-04-19'); assert.deepEqual(st(r), ['appeal_due_soon']);
});

test('the next level counts from the decision, not the denial', () => {
  const r = checkAppeals([D({ denied: '2025-01-01', level: 1, filed: '2025-02-01', decided: '2026-03-01', decision: 'Upheld' })], { asOf });
  assert.equal(r.items[0].deadline, '2026-08-28'); assert.equal(r.items[0].level_name, 'Reconsideration (QIC)');
});

test('a filed appeal is waiting until its decision is due', () => {
  assert.deepEqual(checkAppeals([D({ level: 1, filed: '2026-03-01' })], { asOf }).items, []);
  assert.deepEqual(st(checkAppeals([D({ level: 1, filed: '2026-01-01' })], { asOf })), ['decision_overdue']);
});

test('won appeals drop off and the last level says so', () => {
  assert.equal(checkAppeals([D({ level: 1, filed: '2026-03-01', decided: '2026-04-01', decision: 'Overturned' })], { asOf }).open_denials, 0);
  const r = checkAppeals([D({ payer: 'Sunrise HMO', level: 2, filed: '2026-01-01', decided: '2026-03-01', decision: 'Upheld' })], { asOf });
  assert.match(r.items[0].message, /All 2 appeal levels/);
});

test('payer types with no levels ask for them', () => {
  const r = checkAppeals([D({ payer: 'Mystery Payer' })], { asOf });
  assert.match(r.items[0].message, /No appeal levels are set/);
});
