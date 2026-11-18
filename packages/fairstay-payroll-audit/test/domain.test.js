// Domain checks: payroll audit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditPayroll, overtimeHours, punchHours } from '../src/logic.js';

test('punch hours cross midnight', () => {
  assert.equal(punchHours('18:45', '06:45'), 12); assert.equal(punchHours('07:00', '15:30'), 8.5); assert.equal(punchHours('7:00', ''), null);
});

test('40-hour rule is per workweek, not per pay period', () => {
  // 50 hours in week one, 30 in week two: 10 overtime hours even though the period is 80.
  const daily = { '2026-03-01': 10, '2026-03-02': 10, '2026-03-03': 10, '2026-03-04': 10, '2026-03-05': 10, '2026-03-09': 10, '2026-03-10': 10, '2026-03-11': 10 };
  assert.equal(overtimeHours(daily, { rule: '40' }), 10);
  assert.equal(overtimeHours(daily, { rule: '40', weekStart: 1 }), 0, 'with Monday workweeks the Sunday shift falls in the week before');
});

test('8/80: daily over 8 plus period over 80, never counted twice', () => {
  assert.equal(overtimeHours({ a: 12, b: 12 }, { rule: '8/80' }), 8);
  const ten = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`d${i}`, 8]));
  assert.equal(overtimeHours(ten, { rule: '8/80' }), 8);
});

test('ordinary garnishment 25%, support orders 50%', () => {
  const R = (type, g) => ({ employee_id: 'A', garnishment: g, garnishment_type: type, disposable: 1000 });
  assert.equal(auditPayroll([], [R('Creditor', 250)]).items.length, 0);
  assert.equal(auditPayroll([], [R('Creditor', 260)]).items[0].status, 'garnishment_over_limit');
  assert.equal(auditPayroll([], [R('Child support', 500)]).items.length, 0);
});

test('without differentials the overtime rate check stays quiet', () => {
  const r = auditPayroll([], [{ employee_id: 'A', regular_hours: 40, ot_hours: 2, rate: 20, diff_pay: 0, ot_pay: 50 }]);
  assert.equal(r.items.length, 0);
});
