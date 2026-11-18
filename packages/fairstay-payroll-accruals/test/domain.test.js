// Domain checks: payroll accruals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accruals, earnedShare } from '../src/logic.js';

test('earned share by calendar days', () => {
  assert.equal(earnedShare('2026-03-29', '2026-04-11', '2026-03-31'), 0.214286);
  assert.equal(earnedShare('2026-03-15', '2026-03-28', '2026-03-31'), 1);
  assert.equal(earnedShare('2026-04-01', '2026-04-14', '2026-03-31'), 0);
});

test('wages paid inside the month are not accrued', () => {
  const r = accruals([{ department: 'N', period_start: '2026-03-01', period_end: '2026-03-14', pay_date: '2026-03-20', gross: 1000 }], [], [], { month: '2026-03', employerTaxPct: 0 });
  assert.equal(r.wage_accrual, 0);
});

test('employer taxes are added to wages and, by default, PTO', () => {
  const r = accruals([{ department: 'N', period_start: '2026-03-18', period_end: '2026-03-31', pay_date: '2026-04-03', gross: 1000 }], [{ department: 'N', hours: 10, rate: 20 }], [], { month: '2026-03', employerTaxPct: 10, tolerance: 0 });
  assert.equal(r.wage_accrual, 1100); assert.equal(r.pto_liability, 220);
  assert.deepEqual(r.items.map((i) => i.status), ['under_accrued', 'pto_under_accrued']);
});

test('over-accrued reverses with a credit to expense', () => {
  const r = accruals([], [], [{ department: 'N', kind: 'Wages', amount: 900 }], { month: '2026-03', tolerance: 0 });
  assert.equal(r.items[0].status, 'over_accrued'); assert.deepEqual(r.journal[0], { department: 'N', account: 'Wage expense', debit: 0, credit: 900 });
});
