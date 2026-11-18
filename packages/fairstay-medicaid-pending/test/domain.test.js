// Domain checks: Medicaid pending applications.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPending, appStatus } from '../src/logic.js';

const A = (id, o = {}) => ({ resident_id: id, resident_name: `Res ${id}`, applied_on: o.applied ?? '2026-02-20', status: o.status ?? 'Pending', last_contact: o.contact ?? '2026-03-01', docs_requested: o.req ?? '', docs_received: o.got ?? '', docs_due: o.due ?? '', decision_date: o.decided ?? '', effective_date: o.eff ?? '', billed_through: o.billed ?? '', patient_liability: o.liab ?? '', appeal_filed: o.appeal ?? '', pending_balance: o.bal ?? 1000 });
const asOf = '2026-03-03';
const st = (r) => r.items.map((i) => i.status);

test('status words', () => {
  assert.deepEqual(['Pending', 'Approved', 'Not approved', 'Denied - excess resources', 'RFI sent', 'Withdrawn', 'Eligible', 'Not eligible'].map(appStatus), ['pending', 'approved', 'denied', 'denied', 'rfi', 'withdrawn', 'approved', 'denied']);
});

test('a recent pending application with recent contact has no findings', () => {
  assert.deepEqual(checkPending([A('X')], { asOf }).items, []);
});

test('decision overdue after the state\'s days, not before', () => {
  assert.deepEqual(st(checkPending([A('X', { applied: '2026-01-17' })], { asOf })), [], '45 days exactly is not overdue');
  assert.deepEqual(st(checkPending([A('X', { applied: '2026-01-16' })], { asOf })), ['decision_overdue']);
  assert.deepEqual(st(checkPending([A('X', { applied: '2026-01-16' })], { asOf, decisionDays: 90 })), []);
});

test('documents: received ones are matched without case, overdue and due-soon are separate', () => {
  const r = checkPending([A('X', { req: 'Bank statements; Deed', got: 'bank statements', due: '2026-03-01' })], { asOf });
  assert.deepEqual(st(r), ['docs_overdue']); assert.deepEqual(r.items[0].docs_outstanding, ['Deed']);
  assert.deepEqual(st(checkPending([A('X', { req: 'Deed', due: '2026-03-08' })], { asOf })), ['docs_due_soon']);
  assert.deepEqual(st(checkPending([A('X', { req: 'Deed', got: 'Deed', due: '2026-03-01' })], { asOf })), []);
});

test('approved: unbilled or billed long ago, and a zero liability is set while a blank one is missing', () => {
  assert.deepEqual(st(checkPending([A('X', { status: 'Approved', billed: '2026-02-28', liab: '0' })], { asOf })), []);
  assert.deepEqual(st(checkPending([A('X', { status: 'Approved', billed: '2026-01-15', liab: '0' })], { asOf })), ['approved_not_billed']);
  assert.deepEqual(st(checkPending([A('X', { status: 'Approved', billed: '2026-02-28' })], { asOf })), ['liability_missing']);
});

test('denials: window closing, closed, or nothing when an appeal was filed', () => {
  assert.equal(checkPending([A('X', { status: 'Denied', decided: '2026-02-20' })], { asOf }).items[0].days_left, 19);
  assert.deepEqual(st(checkPending([A('X', { status: 'Denied', decided: '2026-01-20' })], { asOf })), ['appeal_window_closed']);
  assert.deepEqual(st(checkPending([A('X', { status: 'Denied', decided: '2026-01-20', appeal: '2026-02-01' })], { asOf })), []);
});

test('Medicaid pending residents on the census with no application; others are ignored', () => {
  const census = [{ resident_id: 'Y', payer: 'Medicaid Pending', from: '2026-02-01' }, { resident_id: 'Z', payer: 'Medicaid', from: '2026-02-01' }, { resident_id: 'X', payer: 'Medicaid Pending', from: '2026-02-01' }];
  assert.deepEqual(checkPending([A('X')], { asOf, census }).items.map((i) => [i.resident_id, i.status]), [['Y', 'not_applied']]);
});

test('pending balance and aging only count open applications', () => {
  const r = checkPending([A('X', { bal: 500 }), A('Y', { status: 'Approved', billed: '2026-02-28', liab: '0', bal: 900 }), A('Z', { applied: '2025-11-01', bal: 250 })], { asOf });
  assert.equal(r.pending_balance, 750); assert.deepEqual(r.pending_balance_by_age, { '0-30': 500, '121-180': 250 });
});
