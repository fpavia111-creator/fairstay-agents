// Column vocabularies shared by the Fairclaim agents, so a claim export, a remittance
// export or an appointment list reads the same way in every agent, and readers that
// accept either an X12 file or a table and hand back the same shape.
//
// The "also called" names were written from knowledge of common practice-management,
// clearinghouse and EHR exports; none was checked against a live account. A buyer can
// name columns by hand in remedy-sources.json, and `inspect` shows what matched.
//
// Fields marked phi are registered with the patient-data masker when a file is read,
// so their values are also hidden where they appear inside free text.
import { readHealthcareX12, looksX12 } from './hc-x12.js';
import { str, num, round2, isoDate, modifierList } from './billing.js';

const t = (aliases, extra = {}) => ({ aliases, ...extra });
const name = (aliases, extra = {}) => t(aliases, { phi: 'name', ...extra });

export const CLAIM_FIELDS = Object.freeze({
  claim_id: t(['Claim ID', 'Claim Number', 'Claim #', 'Claim No', 'Patient Control Number', 'Encounter ID', 'Encounter Number', 'Visit ID', 'Visit Number', 'Ticket Number', 'Encounter'], { required: true, translate: false }),
  line: t(['Line', 'Line Number', 'Line #', 'Service Line', 'Line No'], { type: 'number', translate: false }),
  patient_name: name(['Patient', 'Patient Name', 'Patient Full Name', 'Pt Name', 'Patient (Last, First)']),
  patient_first: name(['Patient First Name', 'First Name', 'Patient First']),
  patient_last: name(['Patient Last Name', 'Last Name', 'Patient Last']),
  patient_dob: t(['DOB', 'Date of Birth', 'Patient DOB', 'Birth Date', 'Birthdate'], { type: 'date', phi: 'dob' }),
  patient_gender: t(['Gender', 'Sex', 'Patient Sex', 'Patient Gender'], { translate: false }),
  member_id: t(['Member ID', 'Subscriber ID', 'Insured ID', 'Policy Number', 'Policy #', 'Insurance ID', 'Member #', 'Member Number', 'Ins ID'], { phi: 'member_id', translate: false }),
  account: t(['Account Number', 'Patient Account', 'Acct #', 'Account #', 'Account No', 'Patient Acct', 'Acct No'], { phi: 'account', translate: false }),
  mrn: t(['MRN', 'Chart Number', 'Chart #', 'Medical Record Number', 'Chart No'], { phi: 'mrn', translate: false }),
  payer: t(['Payer', 'Payer Name', 'Insurance', 'Primary Insurance', 'Insurance Company', 'Insurance Name', 'Carrier', 'Primary Payer', 'Payor', 'Plan Name']),
  payer_id: t(['Payer ID', 'Payor ID', 'Electronic Payer ID', 'EDI Payer ID', 'Insurance Payer ID'], { translate: false }),
  filing_indicator: t(['Financial Class', 'Claim Filing Indicator', 'Insurance Type', 'Plan Type', 'Fin Class'], { translate: false }),
  billing_npi: t(['Billing NPI', 'Group NPI', 'Billing Provider NPI', 'Practice NPI'], { translate: false }),
  rendering_npi: t(['Rendering NPI', 'Provider NPI', 'Rendering Provider NPI', 'NPI', 'Servicing NPI'], { translate: false }),
  referring_npi: t(['Referring NPI', 'Referring Provider NPI', 'Ordering NPI'], { translate: false }),
  provider: t(['Provider', 'Rendering Provider', 'Provider Name', 'Physician', 'Doctor', 'Clinician', 'Servicing Provider']),
  pos: t(['POS', 'Place of Service', 'Place Of Service Code', 'POS Code'], { translate: false }),
  facility_code: t(['Bill Type', 'Type of Bill', 'TOB', 'Facility Type'], { translate: false }),
  frequency: t(['Frequency', 'Claim Frequency', 'Frequency Code', 'Resubmission Code', 'Claim Frequency Code'], { translate: false }),
  date_of_service: t(['DOS', 'Date of Service', 'Service Date', 'From Date', 'Service From', 'Visit Date', 'Encounter Date', 'DOS From', 'From DOS'], { type: 'date' }),
  date_to: t(['To Date', 'Service To', 'DOS To', 'Thru Date', 'Through Date'], { type: 'date', translate: false }),
  code: t(['CPT', 'CPT Code', 'Procedure', 'Procedure Code', 'HCPCS', 'CPT/HCPCS', 'Service Code', 'Proc Code', 'CDT Code', 'CPT/HCPCS Code', 'Proc'], { translate: false }),
  modifiers: t(['Modifiers', 'Modifier', 'Mod', 'Mods'], { translate: false }),
  modifier_1: t(['Modifier 1', 'Mod 1', 'Modifier1', 'Mod1', 'M1'], { translate: false }),
  modifier_2: t(['Modifier 2', 'Mod 2', 'Modifier2', 'Mod2', 'M2'], { translate: false }),
  modifier_3: t(['Modifier 3', 'Mod 3', 'Modifier3', 'Mod3', 'M3'], { translate: false }),
  modifier_4: t(['Modifier 4', 'Mod 4', 'Modifier4', 'Mod4', 'M4'], { translate: false }),
  units: t(['Units', 'Qty', 'Quantity', 'Days/Units', 'Service Units', 'Days or Units', 'Unit'], { type: 'number' }),
  charge: t(['Charge', 'Charges', 'Charge Amount', 'Billed', 'Billed Amount', 'Line Charge', 'Fee', 'Line Amount', 'Amount Billed'], { type: 'money' }),
  total_charge: t(['Total Charge', 'Claim Total', 'Total Billed', 'Claim Charge', 'Total Charges', 'Claim Amount'], { type: 'money', translate: false }),
  diagnoses: t(['Diagnoses', 'Diagnosis Codes', 'ICD-10 Codes', 'ICD10 Codes', 'Dx Codes', 'ICD Codes', 'Diagnosis'], { translate: false }),
  dx_1: t(['Dx 1', 'Diagnosis 1', 'ICD 1', 'Primary Diagnosis', 'Dx1', 'ICD-10 1', 'Diag 1'], { translate: false }),
  dx_2: t(['Dx 2', 'Diagnosis 2', 'ICD 2', 'Dx2', 'ICD-10 2', 'Diag 2'], { translate: false }),
  dx_3: t(['Dx 3', 'Diagnosis 3', 'ICD 3', 'Dx3', 'ICD-10 3', 'Diag 3'], { translate: false }),
  dx_4: t(['Dx 4', 'Diagnosis 4', 'ICD 4', 'Dx4', 'ICD-10 4', 'Diag 4'], { translate: false }),
  dx_pointer: t(['Dx Pointer', 'Diagnosis Pointer', 'Pointer', 'Dx Ptr', 'Diag Pointer'], { translate: false }),
  prior_auth: t(['Prior Auth', 'Authorization', 'Auth Number', 'Auth #', 'Prior Authorization Number', 'Authorization Number', 'Auth No', 'PA Number'], { translate: false }),
  referral: t(['Referral', 'Referral Number', 'Referral #'], { translate: false }),
  original_ref: t(['Original Claim Number', 'Original Reference', 'Original ICN', 'Original Claim ID', 'Replaces Claim'], { translate: false }),
  revenue_code: t(['Revenue Code', 'Rev Code', 'UB Rev Code', 'Rev'], { translate: false }),
  tooth: t(['Tooth', 'Tooth Number', 'Tooth #', 'Tooth No'], { translate: false }),
  surfaces: t(['Surface', 'Surfaces', 'Tooth Surface'], { translate: false }),
  quadrant: t(['Quadrant', 'Area of Oral Cavity', 'Arch', 'Oral Cavity'], { translate: false }),
  clia: t(['CLIA', 'CLIA Number', 'CLIA #'], { translate: false }),
  submitted_date: t(['Submitted', 'Submit Date', 'Date Submitted', 'Billed Date', 'First Billed', 'Claim Date', 'Sent Date', 'Submission Date', 'Date Billed', 'Bill Date'], { type: 'date' }),
  status: t(['Status', 'Claim Status', 'Current Status']),
  minutes: t(['Minutes', 'Anesthesia Minutes', 'Time (min)', 'Anesthesia Time', 'Total Minutes'], { type: 'number', translate: false }),
  start_time: t(['Start Time', 'Anesthesia Start', 'Start', 'Time In'], { type: 'datetime', translate: false }),
  end_time: t(['End Time', 'Anesthesia End', 'End', 'Time Out'], { type: 'datetime', translate: false }),
  balance: t(['Balance', 'Claim Balance', 'Open Balance', 'Outstanding', 'Insurance Balance', 'Ins Balance'], { type: 'money' }),
});

export const REMIT_FIELDS = Object.freeze({
  claim_id: t(['Claim ID', 'Patient Control Number', 'Claim Number', 'Claim #', 'Encounter ID', 'Encounter', 'PCN', 'Account Claim'], { required: true, translate: false }),
  payer_claim_id: t(['Payer Claim Number', 'ICN', 'Payer Claim ID', 'Claim Control Number', 'Payer ICN', 'Payer Claim Control Number'], { translate: false }),
  patient_name: name(['Patient', 'Patient Name', 'Pt Name']),
  member_id: t(['Member ID', 'Subscriber ID', 'Insured ID', 'Policy Number'], { phi: 'member_id', translate: false }),
  account: t(['Account Number', 'Patient Account', 'Acct #', 'Account #'], { phi: 'account', translate: false }),
  payer: t(['Payer', 'Payer Name', 'Insurance', 'Payor', 'Carrier', 'Insurance Company']),
  payer_id: t(['Payer ID', 'Payor ID'], { translate: false }),
  check_number: t(['Check Number', 'Check #', 'EFT Number', 'EFT Trace', 'Trace Number', 'Payment Reference', 'Check/EFT #', 'Check No', 'EFT #', 'Check/EFT Number'], { translate: false }),
  payment_date: t(['Payment Date', 'Check Date', 'Paid Date', 'Remit Date', 'EFT Date', 'Check/EFT Date', 'Date Paid', 'Posted Date'], { type: 'date' }),
  claim_status: t(['Claim Status Code', 'Status Code', 'CLP02', 'Claim Status'], { translate: false }),
  date_of_service: t(['DOS', 'Date of Service', 'Service Date', 'From Date'], { type: 'date' }),
  code: t(['CPT', 'CPT Code', 'Procedure', 'Procedure Code', 'HCPCS', 'Proc Code', 'Service Code', 'CDT Code'], { translate: false }),
  modifiers: t(['Modifiers', 'Modifier', 'Mod'], { translate: false }),
  units: t(['Units', 'Qty', 'Paid Units', 'Units Paid'], { type: 'number' }),
  billed: t(['Billed', 'Charge', 'Billed Amount', 'Charges', 'Submitted Charge', 'Charge Amount', 'Line Charge'], { type: 'money' }),
  allowed: t(['Allowed', 'Allowed Amount', 'Allowable', 'Allowed Amt'], { type: 'money' }),
  paid: t(['Paid', 'Paid Amount', 'Payment', 'Insurance Paid', 'Payer Paid', 'Ins Paid', 'Paid Amt', 'Payment Amount'], { type: 'money' }),
  patient_responsibility: t(['Patient Responsibility', 'Pt Resp', 'PR Amount', 'Patient Portion', 'Patient Resp'], { type: 'money' }),
  adjustment_group: t(['Group Code', 'Adj Group', 'Adjustment Group', 'CAS Group', 'Group'], { translate: false }),
  adjustment_reason: t(['Reason Code', 'CARC', 'Adj Reason', 'Adjustment Reason', 'Adjustment Code', 'Denial Code', 'Adj Code', 'Reason'], { translate: false }),
  adjustment_amount: t(['Adjustment', 'Adj Amount', 'Adjustment Amount', 'Adj Amt', 'Write Off', 'Contractual'], { type: 'money' }),
  adjustments: t(['Adjustments', 'Adjustment Codes', 'CARC Codes', 'CAS', 'Adjustment Detail'], { translate: false }),
  remarks: t(['Remark Codes', 'RARC', 'Remarks', 'Remark', 'Remark Code', 'RARC Codes'], { translate: false }),
  rendering_npi: t(['Rendering NPI', 'Provider NPI', 'NPI'], { translate: false }),
  provider: t(['Provider', 'Rendering Provider', 'Provider Name']),
  received_date: t(['Received Date', 'Date Received', 'Payer Received'], { type: 'date', translate: false }),
  submitted_date: t(['Submitted', 'Submit Date', 'Date Submitted', 'Billed Date', 'Claim Date'], { type: 'date' }),
});

export const DEPOSIT_FIELDS = Object.freeze({
  date: t(['Posting Date', 'Date', 'Deposit Date', 'Transaction Date', 'Post Date', 'Value Date', 'Effective Date'], { type: 'date', required: true }),
  amount: t(['Amount', 'Credit', 'Deposit Amount', 'Credit Amount', 'Deposits', 'Transaction Amount'], { type: 'money', required: true }),
  description: t(['Description', 'Memo', 'Details', 'Narrative', 'Transaction Description', 'Payee', 'Bank Description']),
  trace_number: t(['Trace Number', 'Reference', 'TRN', 'Addenda', 'EFT Trace', 'Reference Number', 'Ref', 'Customer Reference'], { translate: false }),
  payer: t(['Originator', 'Company Name', 'Originator Name', 'Payer', 'Company'], { translate: false }),
  deposit_id: t(['Transaction ID', 'Deposit ID', 'ID', 'Bank Reference'], { translate: false }),
});

export const APPOINTMENT_FIELDS = Object.freeze({
  appointment_id: t(['Appointment ID', 'Appt ID', 'Visit ID', 'Encounter ID', 'Appointment #', 'Appt #', 'Visit Number'], { required: true, translate: false }),
  patient_name: name(['Patient', 'Patient Name', 'Pt Name']),
  mrn: t(['MRN', 'Chart Number', 'Chart #', 'Patient ID'], { phi: 'mrn', translate: false }),
  account: t(['Account Number', 'Patient Account', 'Acct #'], { phi: 'account', translate: false }),
  date: t(['Appointment Date', 'Date', 'Visit Date', 'Appt Date', 'DOS', 'Date of Service', 'Scheduled Date'], { type: 'date' }),
  time: t(['Time', 'Appointment Time', 'Start Time', 'Appt Time'], { translate: false }),
  provider: t(['Provider', 'Resource', 'Rendering Provider', 'Provider Name', 'Doctor', 'Clinician']),
  status: t(['Status', 'Appointment Status', 'Visit Status', 'Appt Status']),
  type: t(['Appointment Type', 'Visit Type', 'Type', 'Reason', 'Appt Type']),
  payer: t(['Payer', 'Insurance', 'Primary Insurance', 'Carrier']),
  member_id: t(['Member ID', 'Subscriber ID', 'Insurance ID'], { phi: 'member_id', translate: false }),
  location: t(['Location', 'Facility', 'Department', 'Office', 'Site']),
  claim_id: t(['Claim ID', 'Encounter Claim', 'Claim Number'], { translate: false }),
});

/** Parse "CO-45 12.00; PR-2 10.00" (or "CO45:12.00 | OA-23") into adjustments. */
export function parseAdjustments(v) {
  const out = [];
  const re = /\b(CO|PR|OA|PI|CR)\s*[-:\s]\s*([A-Z]{0,2}\d{1,3}|[A-Z]\d{1,2})\b(?:\s*[:=@]?\s*\(?\$?(-?[\d,]*\.?\d+)\)?)?/gi;
  let m;
  while ((m = re.exec(String(v ?? '')))) out.push({ group: m[1].toUpperCase(), reason: m[2].toUpperCase().replace(/^0+(?=\d)/, ''), amount: m[3] !== undefined ? num(m[3]) ?? 0 : null, quantity: null });
  return out;
}
const codesIn = (v) => str(v).split(/[\s,;|]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);

// ------------------------------------------------------------- grouping ----

/** Table rows (CLAIM_FIELDS names) → claims in the same shape read837 produces. */
export function groupClaims(rows) {
  const m = new Map();
  for (const r of rows) {
    const id = str(r.claim_id); if (!id) continue;
    let c = m.get(id);
    if (!c) {
      const nm = str(r.patient_name) || [str(r.patient_first), str(r.patient_last)].filter(Boolean).join(' ') || null;
      c = {
        claim_id: id, total_charge: num(r.total_charge), claim_type: str(r.revenue_code) || str(r.facility_code) ? 'institutional' : /^D\d{4}$/i.test(str(r.code)) ? 'dental' : 'professional',
        pos: str(r.pos) || null, facility_code: str(r.facility_code) || null, frequency: str(r.frequency) || '1',
        payer_name: str(r.payer) || null, payer_id: str(r.payer_id) || null, filing_indicator: str(r.filing_indicator) || null,
        patient_name: nm, patient_dob: isoDate(r.patient_dob), patient_gender: str(r.patient_gender) || null, member_id: str(r.member_id) || null, account: str(r.account) || null, mrn: str(r.mrn) || null,
        billing_npi: str(r.billing_npi) || null, rendering_npi: str(r.rendering_npi) || null, referring_npi: str(r.referring_npi) || null, provider: str(r.provider) || null,
        prior_auth: str(r.prior_auth) || null, referral: str(r.referral) || null, original_ref: str(r.original_ref) || null, clia: str(r.clia) || null,
        submitted_date: isoDate(r.submitted_date), status: str(r.status) || null, balance: num(r.balance),
        diagnoses: [], lines: [], source_rows: 0,
      };
      m.set(id, c);
    }
    c.source_rows++;
    for (const k of ['pos', 'payer_name', 'rendering_npi', 'billing_npi', 'prior_auth', 'original_ref', 'clia', 'provider']) if (!c[k] && str(r[k === 'payer_name' ? 'payer' : k])) c[k] = str(r[k === 'payer_name' ? 'payer' : k]);
    if (c.total_charge === null && num(r.total_charge) !== null) c.total_charge = num(r.total_charge);
    if (c.balance === null && num(r.balance) !== null) c.balance = num(r.balance);
    const dx = [...codesIn(r.diagnoses), ...['dx_1', 'dx_2', 'dx_3', 'dx_4'].map((k) => str(r[k]).toUpperCase()).filter(Boolean)];
    for (const d of dx) if (!c.diagnoses.some((x) => x.code === d)) c.diagnoses.push({ qualifier: c.diagnoses.length ? 'ABF' : 'ABK', code: d });
    if (str(r.code) || num(r.charge) !== null) {
      const mods = [...modifierList(r.modifiers), ...['modifier_1', 'modifier_2', 'modifier_3', 'modifier_4'].map((k) => str(r[k]).toUpperCase()).filter(Boolean)];
      c.lines.push({
        line: num(r.line) ?? c.lines.length + 1, qualifier: /^D\d{4}$/i.test(str(r.code)) ? 'AD' : 'HC', code: str(r.code).toUpperCase() || null, modifiers: [...new Set(mods)], charge: num(r.charge) ?? 0,
        units: num(r.units), unit_basis: num(r.minutes) !== null ? 'MJ' : 'UN', pos: str(r.pos) || null, pointers: str(r.dx_pointer).split(/[\s,;:|]+/).map((x) => (/^[A-L]$/i.test(x) ? x.toUpperCase().charCodeAt(0) - 64 : Number(x))).filter((x) => Number.isInteger(x) && x > 0),
        date_from: isoDate(r.date_of_service), date_to: isoDate(r.date_to) || isoDate(r.date_of_service), revenue_code: str(r.revenue_code) || null, rendering_npi: str(r.rendering_npi) || null,
        tooth: str(r.tooth) || null, surfaces: str(r.surfaces).toUpperCase().replace(/[^A-Z]/g, '').split('').filter(Boolean), quadrant: str(r.quadrant).toUpperCase() || null,
        minutes: num(r.minutes), start_time: str(r.start_time) || null, end_time: str(r.end_time) || null, prior_auth: null,
      });
    }
  }
  for (const c of m.values()) {
    c.lines_total = round2(c.lines.reduce((s, l) => s + (l.charge || 0), 0));
    if (c.total_charge === null) c.total_charge = c.lines_total;
    const dates = c.lines.map((l) => l.date_from).filter(Boolean).sort();
    c.service_from = dates[0] || null; c.service_to = c.lines.map((l) => l.date_to).filter(Boolean).sort().at(-1) || c.service_from;
  }
  return [...m.values()];
}

/** Table rows (REMIT_FIELDS names) → { payments, claims } in the shape read835 produces. */
export function groupRemits(rows) {
  const m = new Map(); const pays = new Map();
  for (const r of rows) {
    const id = str(r.claim_id); if (!id) continue;
    const chk = str(r.check_number);
    const key = `${id}|${chk}|${str(r.payer_claim_id)}`;
    let c = m.get(key);
    if (!c) {
      c = { claim_id: id, status: str(r.claim_status) || null, charge: 0, paid: 0, patient_responsibility: 0, filing_indicator: null, payer_claim_id: str(r.payer_claim_id) || null, patient_name: str(r.patient_name) || null, member_id: str(r.member_id) || null, account: str(r.account) || null, rendering_npi: str(r.rendering_npi) || null, provider: str(r.provider) || null, payer: str(r.payer) || null, payer_id: str(r.payer_id) || null, check_number: chk || null, payment_date: isoDate(r.payment_date), received_date: isoDate(r.received_date), submitted_date: isoDate(r.submitted_date), adjustments: [], remarks: [], lines: [], _keys: new Map() };
      m.set(key, c);
      if (chk) { const p = pays.get(chk) || { trace_number: chk, payer: c.payer, date: c.payment_date, amount: 0, claims: 0 }; p.claims++; pays.set(chk, p); }
    }
    const adj = [...parseAdjustments(r.adjustments)];
    if (str(r.adjustment_reason)) adj.push({ group: str(r.adjustment_group).toUpperCase() || (str(r.adjustment_reason).match(/^(CO|PR|OA|PI|CR)/i) || [''])[0].toUpperCase() || 'CO', reason: str(r.adjustment_reason).toUpperCase().replace(/^(CO|PR|OA|PI|CR)[-\s:]*/, '').replace(/^0+(?=\d)/, ''), amount: num(r.adjustment_amount) ?? 0, quantity: null });
    const remarks = codesIn(r.remarks);
    const lk = `${str(r.code)}|${isoDate(r.date_of_service) || ''}|${str(r.modifiers)}`;
    const billed = num(r.billed), paid = num(r.paid);
    let line = c._keys.get(lk);
    // One row per adjustment repeats the line: same code, date and billed amount add to that line.
    if (line && (billed === null || billed === line.charge) && (paid === null || paid === line.paid)) { line.adjustments.push(...adj); for (const x of remarks) if (!line.remarks.includes(x)) line.remarks.push(x); continue; }
    line = { qualifier: 'HC', code: str(r.code).toUpperCase() || null, modifiers: modifierList(r.modifiers), charge: billed ?? 0, paid: paid ?? 0, allowed: num(r.allowed), units: num(r.units) ?? 1, date_from: isoDate(r.date_of_service), date_to: isoDate(r.date_of_service), adjustments: adj, remarks, revenue_code: null };
    c._keys.set(lk, line); c.lines.push(line);
    c.charge = round2(c.charge + line.charge); c.paid = round2(c.paid + line.paid);
    c.patient_responsibility = round2(c.patient_responsibility + (num(r.patient_responsibility) ?? 0));
    if (chk) { const p = pays.get(chk); p.amount = round2(p.amount + line.paid); }
  }
  const claims = [...m.values()].map(({ _keys, ...c }) => {
    if (!c.patient_responsibility) c.patient_responsibility = round2(c.lines.flatMap((l) => l.adjustments).filter((a) => a.group === 'PR').reduce((s, a) => s + (a.amount || 0), 0));
    if (!c.status) c.status = c.paid > 0 ? '1' : c.lines.length && c.lines.every((l) => l.paid === 0) ? '4' : '1';
    return c;
  });
  return { payments: [...pays.values()], claims };
}

// --------------------------------------------------------------- readers ----

const x12Text = (ctx, path) => (/\.(edi|x12|txt|835|837|999|277|271|278|era|dat)$/i.test(path) ? ctx.readText(path) : null);
const register = (ctx, records) => { if (ctx && ctx.phi) ctx.phi.registerRecords(records); };

/**
 * Claims from an 837 file or a claim export. Returns { claims, source, x12 } where
 * x12 holds envelope and balancing problems when the file was EDI.
 */
export function readClaims(ctx, path, kind = 'claims') {
  const text = x12Text(ctx, path);
  if (text !== null && looksX12(text)) {
    const r = readHealthcareX12(text);
    const claims = (r.by_set['837'] || []).flatMap((x) => x.claims.map((c) => ({ ...c, transaction_control: x.control })));
    if (!claims.length) throw new Error(`${path} is an X12 file but holds no 837 claims (sets found: ${r.sets.join(', ') || 'none'})`);
    register(ctx, claims);
    return { claims, source: '837', x12: { problems: r.problems, skipped_sets: r.skipped_sets, interchanges: r.interchanges } };
  }
  return { claims: groupClaims(ctx.records(path, kind)), source: 'table', x12: null };
}

/**
 * Remittances from an 835 file or a payment/ERA export.
 * Returns { payments: [{ trace_number, payer, date, amount, method, claims }], claims, plb, source, x12 }.
 * Each claim carries check_number, payer and payment_date from its payment.
 */
export function readRemits(ctx, path, kind = 'remits') {
  const text = x12Text(ctx, path);
  if (text !== null && looksX12(text)) {
    const r = readHealthcareX12(text);
    const sets = r.by_set['835'] || [];
    if (!sets.length) throw new Error(`${path} is an X12 file but holds no 835 remittance (sets found: ${r.sets.join(', ') || 'none'})`);
    const payments = []; const claims = []; const plb = [];
    for (const s of sets) {
      const p = { trace_number: s.payment.trace_number, payer: s.payment.payer, payer_id: s.payment.payer_id, date: s.payment.date, amount: s.payment.amount, method: s.payment.method, handling: s.payment.handling, payee_npi: s.payment.payee_npi, claims: s.claims.length, provider_adjustments: s.plb };
      payments.push(p); plb.push(...s.plb.map((x) => ({ ...x, trace_number: p.trace_number, payer: p.payer })));
      for (const c of s.claims) claims.push({ ...c, payer: p.payer, payer_id: p.payer_id, check_number: p.trace_number, payment_date: p.date });
    }
    register(ctx, claims);
    return { payments, claims, plb, source: '835', x12: { problems: r.problems, skipped_sets: r.skipped_sets } };
  }
  const g = groupRemits(ctx.records(path, kind));
  return { payments: g.payments, claims: g.claims, plb: [], source: 'table', x12: null };
}

/** Any healthcare X12 file through ctx, with PHI registered. Throws when the file is not X12. */
export function readX12File(ctx, path) {
  const text = ctx.readText(path);
  if (!looksX12(text)) throw new Error(`${path} is not an X12 file (no ISA segment at the start)`);
  const r = readHealthcareX12(text);
  for (const list of Object.values(r.by_set)) for (const x of list) for (const k of ['claims', 'members', 'reviews']) if (Array.isArray(x[k])) register(ctx, x[k]);
  return r;
}

/** All adjustments of a remit claim (claim level and line level), each with its line code. */
export const allAdjustments = (c) => [...(c.adjustments || []).map((a) => ({ ...a, line: null, code: null })), ...(c.lines || []).flatMap((l) => (l.adjustments || []).map((a) => ({ ...a, line: l, code: l.code })))];
/** All remark codes on a remit claim. */
export const allRemarks = (c) => [...new Set([...(c.remarks || []), ...(c.lines || []).flatMap((l) => l.remarks || [])])];
