// Core billing pieces every Remedy agent leans on: X12 837/835 reading, PHI masking,
// identifiers and dates, denial categories, remit grouping, report text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildX12, readHealthcareX12, looksX12, PhiMasker, phiKindOf, npiValid, npiProblem, icd10Valid, icd10Norm, codeFamily, modifierList,
  isoDate, daysBetween, addMonths, bucketOf, payerKey, pct, sum, reasonInfo, categorise, denialLines, parseAdjustments, groupRemits, groupClaims,
  sectionTitle, SECTION_TITLES, LANGS, EXPORTS, exportProfile, CLAIM_FIELDS, REMIT_FIELDS,
} from '../src/index.js';

const segs837 = { set: '837', version: '005010X222A1', segments: [
  ['BHT', '0019', '00', 'B1', '20260115', '1200', 'CH'], ['NM1', '41', '2', 'SUBMITTER', '', '', '', '', '46', 'S1'], ['NM1', '40', '2', 'RECEIVER', '', '', '', '', '46', 'R1'],
  ['HL', '1', '', '20', '1'], ['NM1', '85', '2', 'EXAMPLE CLINIC', '', '', '', '', 'XX', '2990000012'], ['N3', '1 Main St'], ['N4', 'Exampleton', 'AK', '995011234'], ['REF', 'EI', '990000001'],
  ['HL', '2', '1', '22', '0'], ['SBR', 'P', '18', '', '', '', '', '', '', 'CI'], ['NM1', 'IL', '1', 'TESTPERSON', 'ALEX', '', '', '', 'MI', 'MEM12345678'], ['DMG', 'D8', '19800102', 'F'], ['NM1', 'PR', '2', 'EXAMPLE PLAN', '', '', '', '', 'PI', '99901'],
  ['CLM', 'C100', '250.00', '', '', ['11', 'B', '1'], 'Y', 'A', 'Y', 'Y'], ['HI', ['ABK', 'E119'], ['ABF', 'I10']],
  ['LX', '1'], ['SV1', ['HC', '99214', '25'], '200.00', 'UN', '1', '', '', '1'], ['DTP', '472', 'D8', '20260110'],
  ['LX', '2'], ['SV1', ['HC', '36415'], '50.00', 'UN', '1', '', '', '1'], ['DTP', '472', 'D8', '20260110'],
] };
const segs835 = { set: '835', version: '005010X221A1', segments: [
  ['BPR', 'I', '110.00', 'C', 'ACH', 'CCP', '01', '999999999', 'DA', '1', '1999999999', '', '01', '999999999', 'DA', '2', '20260201'], ['TRN', '1', 'EFT1', '1999999999'], ['DTM', '405', '20260201'],
  ['N1', 'PR', 'EXAMPLE PLAN'], ['N1', 'PE', 'EXAMPLE CLINIC', 'XX', '2990000012'], ['LX', '1'],
  ['CLP', 'C100', '1', '250.00', '110.00', '20.00', '12', 'ICN1'], ['NM1', 'QC', '1', 'TESTPERSON', 'ALEX', '', '', '', 'MI', 'MEM12345678'],
  ['SVC', ['HC', '99214', '25'], '200.00', '110.00', '', '1'], ['DTM', '472', '20260110'], ['CAS', 'CO', '45', '70.00'], ['CAS', 'PR', '3', '20.00'], ['AMT', 'B6', '130.00'],
  ['SVC', ['HC', '36415'], '50.00', '0.00', '', '1'], ['DTM', '472', '20260110'], ['CAS', 'CO', '97', '50.00'], ['LQ', 'HE', 'M15'],
] };

test('837P round trip: claim, patient, payer, diagnoses and lines', () => {
  const text = buildX12([segs837]);
  assert.ok(looksX12(text));
  const r = readHealthcareX12(text);
  const c = r.by_set['837'][0].claims[0];
  assert.equal(c.claim_id, 'C100'); assert.equal(c.total_charge, 250); assert.equal(c.member_id, 'MEM12345678'); assert.equal(c.patient_dob, '1980-01-02');
  assert.deepEqual(c.diagnoses.map((d) => d.code), ['E119', 'I10']);
  assert.deepEqual(c.lines.map((l) => [l.code, l.modifiers.join(','), l.charge, l.date_from]), [['99214', '25', 200, '2026-01-10'], ['36415', '', 50, '2026-01-10']]);
  assert.deepEqual(r.problems, []);
});

test('835 round trip: payment, claim money, line adjustments, allowed and remarks', () => {
  const r = readHealthcareX12(buildX12([segs835]));
  const s = r.by_set['835'][0];
  assert.equal(s.payment.amount, 110); assert.equal(s.payment.date, '2026-02-01'); assert.equal(s.payment.trace_number, 'EFT1');
  const c = s.claims[0];
  assert.equal(c.paid, 110); assert.equal(c.patient_responsibility, 20); assert.equal(c.lines[0].allowed, 130);
  assert.deepEqual(c.lines[1].adjustments.map((a) => `${a.group}-${a.reason}:${a.amount}`), ['CO-97:50']);
  assert.deepEqual(c.lines[1].remarks, ['M15']);
});

test('denials skip contractual write-downs and cost-sharing, and categorise the rest', () => {
  const s = readHealthcareX12(buildX12([segs835])).by_set['835'][0];
  const rows = denialLines(s.claims.map((c) => ({ ...c, payer: 'Example Plan' })));
  assert.equal(rows.length, 1); assert.equal(rows[0].reason, '97'); assert.equal(rows[0].code, '36415');
  assert.equal(categorise({ group: 'CO', reason: '045' }).category, 'not_denial');
  assert.equal(categorise({ group: 'CO', reason: '197' }).category, 'authorization');
  assert.equal(categorise({ group: 'CO', reason: '197' }, { payer: 'X', payerMap: [{ code: '197', payer: 'X', category: 'eligibility' }] }).category, 'eligibility');
  assert.ok(reasonInfo('16').text.length > 5);
});

test('PHI: names, member ids and birth dates are masked in fields and in free text; pseudonyms are stable and resolvable', () => {
  const m = new PhiMasker({ mode: 'mask', key: Buffer.alloc(32, 7) });
  m.register('name', 'Alex Testperson'); m.register('member_id', 'MEM12345678');
  const out = m.maskResult({ patient_name: 'Alex Testperson', member_id: 'MEM12345678', patient_dob: '1980-01-02', note: 'Call TESTPERSON, ALEX about MEM12345678 at 907-555-0100', mapped: { patient_name: 'Patient' }, by_check: { member_id: 3 } });
  assert.match(out.patient_name, /^PT-[0-9a-f]{8}$/); assert.match(out.member_id, /^MBR-[0-9a-f]{8}$/); assert.equal(out.patient_dob, '1980 (birth year)');
  assert.doesNotMatch(out.note, /TESTPERSON|MEM12345678|555-0100/i);
  assert.equal(out.mapped.patient_name, 'Patient'); assert.equal(out.by_check.member_id, 3);
  assert.equal(m.token('name', 'Alex Testperson'), out.patient_name);
  assert.ok(m.same('Alex Testperson', out.patient_name, 'name'));
  const strict = new PhiMasker({ mode: 'strict', key: Buffer.alloc(32, 7) });
  assert.equal(strict.maskResult({ patient_dob: '1980-01-02' }).patient_dob, '[DOB]');
  assert.equal(new PhiMasker({ mode: 'off' }).maskResult({ patient_name: 'Alex' }).patient_name, 'Alex');
  assert.equal(phiKindOf('Patient Name'), 'name');
});

test('identifiers, codes and dates', () => {
  assert.equal(npiValid('1234567893'), true); assert.equal(npiProblem('1234567890'), 'check digit is wrong'); assert.equal(npiProblem('123'), 'not 10 digits');
  assert.equal(icd10Valid('E11.9'), true); assert.equal(icd10Valid('U07.1'), true); assert.equal(icd10Valid('7E11'), false); assert.equal(icd10Norm('e11.9'), 'E119');
  assert.equal(codeFamily('99213'), 'cpt'); assert.equal(codeFamily('G0439'), 'hcpcs'); assert.equal(codeFamily('D0120'), 'cdt');
  assert.deepEqual(modifierList('25, 59 xs'), ['25', '59', 'XS']);
  assert.equal(isoDate('2026-02-03T10:00:00Z'), '2026-02-03'); assert.equal(daysBetween('2026-01-31', '2026-03-01'), 29);
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28'); assert.equal(bucketOf(45), '31-60'); assert.equal(bucketOf(121), '120+');
  assert.equal(payerKey('Example Health Plan, Inc.'), payerKey('example health plan inc')); assert.equal(pct(1, 3), 33.33); assert.equal(sum([0.1, 0.2]), 0.3);
});

test('remit and claim exports group by claim; adjustment strings parse', () => {
  assert.deepEqual(parseAdjustments('CO-45 70.00; PR-3: 20'), [{ group: 'CO', reason: '45', amount: 70, quantity: null }, { group: 'PR', reason: '3', amount: 20, quantity: null }]);
  const g = groupRemits([{ claim_id: 'C1', check_number: 'K1', payment_date: '2026-02-01', paid: '50', billed: '100', adjustments: 'CO-45 50', code: '99213' }, { claim_id: 'C1', check_number: 'K1', payment_date: '2026-02-01', paid: '0', billed: '20', adjustments: 'CO-97 20', code: '36415' }]);
  assert.equal(g.claims.length, 1); assert.equal(g.claims[0].lines.length, 2);
  const c = groupClaims([{ claim_id: 'A', code: '99213', charge: '100', date_of_service: '2026-01-02', diagnoses: 'E11.9, I10' }, { claim_id: 'A', code: '36415', charge: '20', date_of_service: '2026-01-02' }]);
  assert.equal(c.length, 1); assert.equal(c[0].lines.length, 2); assert.deepEqual(c[0].diagnoses.map((d) => d.code), ['E11.9', 'I10']);
});

test('every section title and export profile is complete', () => {
  for (const [k, t] of Object.entries(SECTION_TITLES)) for (const l of LANGS) assert.ok(t[l], `${k} has no ${l}`);
  assert.deepEqual(sectionTitle('nope'), { en: 'nope' });
  for (const [id, e] of Object.entries(EXPORTS)) { assert.ok(e.signature && e.signature.length && ['recalled', 'documented'].includes(e.basis), `${id} has a signature and basis`); assert.equal(exportProfile(id, {}).map && typeof exportProfile(id, {}).map, 'object'); }
  assert.throws(() => exportProfile('no_such_export', {}), /unknown export/);
  for (const fields of [CLAIM_FIELDS, REMIT_FIELDS]) for (const [k, f] of Object.entries(fields)) assert.ok(Array.isArray(f.aliases) && f.aliases.length, `${k} has aliases`);
});

test('a semicolon export with whole numbers grouped by dots (1.800) reads them as thousands', async () => {
  const { adaptRecords, decimalEvidence } = await import('../src/index.js');
  const def = { fields: { code: { aliases: ['CPT'] }, volume: { aliases: ['Units', 'Menge'], type: 'number' } } };
  const r = adaptRecords({ delimiter: ';', matrix: [['CPT', 'Menge'], ['99213', '1.800'], ['97110', '900']] }, def);
  assert.deepEqual(r.rows.map((x) => Number(x.volume)), [1800, 900]);
  const us = adaptRecords({ delimiter: ',', matrix: [['CPT', 'Units'], ['99213', '1.5'], ['97110', '900']] }, def);
  assert.deepEqual(us.rows.map((x) => Number(x.volume)), [1.5, 900]);
  assert.deepEqual(decimalEvidence(['1.234.567']), { comma: 2, dot: 0 });
});
