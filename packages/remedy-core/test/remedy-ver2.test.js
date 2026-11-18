// Core changes in ver 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reasonInfo, MODIFIERS } from '../src/index.js';
import { completedOnly, EXPORTS, EXPORTS_BASIS_NOTE } from '../src/exports.js';

test('a reason code override may be a bare category or an object, and keeps the built-in text when it gives none', () => {
  assert.deepEqual([reasonInfo('197', { overrides: { 197: 'documentation' } }).category, reasonInfo('197', { overrides: { 197: 'documentation' } }).source], ['documentation', 'config']);
  assert.match(reasonInfo('197', { overrides: { 197: { category: 'coding' } } }).text, /\S/);
  assert.equal(reasonInfo('Z99', { overrides: { Z99: 'payer_error' } }).category, 'payer_error');
});

test('modifier pairs that cannot share a line include the anesthesia direction and equipment purchase or rental pairs', () => {
  const has = (a, b) => MODIFIERS.pairs_that_conflict.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (const [a, b] of [['AA', 'QY'], ['QK', 'QY'], ['AA', 'QZ'], ['25', '57'], ['NU', 'RR'], ['NU', 'UE'], ['RR', 'UE'], ['26', 'TC']]) assert.ok(has(a, b), `${a} ${b}`);
  assert.ok(!has('QY', 'QX'), 'a directing anesthesiologist and the directed CRNA bill on separate lines and are not a conflict');
});

test('the Open Dental layout keeps completed procedures only, and leaves a query without a status column alone', () => {
  const hook = completedOnly('ProcStatus');
  assert.deepEqual(hook([{ ProcStatus: '2', c: 1 }, { ProcStatus: '1', c: 2 }, { ProcStatus: 'C', c: 3 }, { ProcStatus: 'TP', c: 4 }]).map((r) => r.c), [1, 3]);
  assert.deepEqual(hook([{ c: 1 }, { c: 2 }]).map((r) => r.c), [1, 2]);
  assert.equal(EXPORTS.open_dental_procedures.basis, 'documented');
  assert.match(EXPORTS_BASIS_NOTE, /Open Dental/);
});
