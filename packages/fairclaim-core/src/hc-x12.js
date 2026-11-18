// Readers for the HIPAA X12 transaction sets medical billing runs on:
//
//   835  Health Care Claim Payment/Advice (ERA)      read835
//   837  Health Care Claim (professional, institutional, dental)  read837
//   999  Implementation Acknowledgment                read999
//   277  Claim Acknowledgment (277CA) and status      read277
//   271  Eligibility Benefit Response                 read271
//   278  Services Review response (prior auth)        read278
//
// Element positions follow the public 005010 structure as recalled from the
// published layouts. They were NOT checked against the licensed X12 TR3
// implementation guides, and payers and clearinghouses differ. Every record keeps
// the segment numbers it came from, so a person can check what was read.
//
// The readers return patient names, birth dates and member ids as they are in the
// file. The runtime masks them before a result reaches a model (see phi.js); a tool
// handler that writes a local file keeps the real values.
import { parseX12, clean, x12Date, plain } from './x12.js';

const money = (v) => { const n = plain(v); return n === null ? null : Math.round(n * 100) / 100; };
const parts = (v, comp) => String(v ?? '').split(comp).map(clean);
const name = (e) => [clean(e[4]), clean(e[5])].filter(Boolean).join(' ') + (clean(e[3]) ? (clean(e[4]) ? ` ${clean(e[3])}` : clean(e[3])) : '');
/** "D8*20250102" or "RD8*20250101-20250131" → { from, to }. */
const period = (fmt, v) => {
  const f = clean(fmt), s = clean(v);
  if (f === 'RD8' && s.includes('-')) { const [a, b] = s.split('-'); return { from: x12Date(a), to: x12Date(b) }; }
  const d = x12Date(s); return { from: d, to: d };
};

/** CAS segment → adjustments [{ group, reason, amount, quantity }]. Up to six reasons per segment. */
export function casAdjustments(e) {
  const out = []; const group = clean(e[1]);
  for (let k = 0; k < 6; k++) {
    const reason = clean(e[2 + 3 * k]); if (!reason) continue;
    out.push({ group, reason, amount: money(e[3 + 3 * k]) ?? 0, quantity: plain(e[4 + 3 * k]) });
  }
  return out;
}

const sumAmt = (xs) => Math.round(xs.reduce((s, x) => s + (Number(x.amount) || 0), 0) * 100) / 100;

// ------------------------------------------------------------------ 835 ----

/**
 * 835 → { payment, claims, plb, problems }.
 * payment: { amount, credit_debit, method, handling, date, trace_number, payer_tax_id, payer, payer_id, payee, payee_npi, production_date }
 * claims:  [{ claim_id, status, charge, paid, patient_responsibility, filing_indicator, payer_claim_id,
 *            facility_code, frequency, patient_name, member_id, insured_name, rendering_npi,
 *            statement_from, statement_to, received_date, adjustments, remarks, lines, segments }]
 * Balancing checks (problems): line charge − line adjustments = line paid; claim charge −
 * all adjustments = claim paid; sum of claim payments − provider adjustments = BPR02.
 */
export function read835(tx, comp = ':') {
  const segs = tx.segments; const problems = [];
  const payment = { amount: null, credit_debit: null, method: null, handling: null, date: null, trace_number: null, payer_tax_id: null, payer: null, payer_id: null, payee: null, payee_npi: null, production_date: null };
  const claims = []; const plb = [];
  let claim = null, line = null, n1 = null;
  const p = (seg, code, message) => problems.push({ segment: seg ? seg.n : null, code, message });
  for (const s of segs) {
    const e = s.el;
    switch (s.id) {
      case 'BPR': Object.assign(payment, { handling: clean(e[1]), amount: money(e[2]), credit_debit: clean(e[3]), method: clean(e[4]), date: x12Date(e[16]) }); break;
      case 'TRN': if (clean(e[1]) === '1') { payment.trace_number = clean(e[2]); payment.payer_tax_id = clean(e[3]).replace(/^1/, '') || null; } break;
      case 'DTM':
        if (!claim && clean(e[1]) === '405') payment.production_date = x12Date(e[2]);
        else if (line && ['472', '150'].includes(clean(e[1]))) { line.date_from = x12Date(e[2]); if (clean(e[1]) === '472' || !line.date_to) line.date_to = line.date_from; }
        else if (line && clean(e[1]) === '151') line.date_to = x12Date(e[2]);
        else if (claim && clean(e[1]) === '232') claim.statement_from = x12Date(e[2]);
        else if (claim && clean(e[1]) === '233') claim.statement_to = x12Date(e[2]);
        else if (claim && clean(e[1]) === '050') claim.received_date = x12Date(e[2]);
        break;
      case 'N1':
        n1 = clean(e[1]);
        if (n1 === 'PR') payment.payer = clean(e[2]);
        if (n1 === 'PE') { payment.payee = clean(e[2]); if (clean(e[3]) === 'XX') payment.payee_npi = clean(e[4]); }
        break;
      case 'REF':
        if (!claim && n1 === 'PR' && clean(e[1]) === '2U') payment.payer_id = clean(e[2]);
        if (line && clean(e[1]) === '6R') line.line_control = clean(e[2]);
        else if (claim && !line && clean(e[1]) === '1L') claim.group_number = clean(e[2]);
        break;
      case 'CLP':
        claim = { claim_id: clean(e[1]), status: clean(e[2]), charge: money(e[3]) ?? 0, paid: money(e[4]) ?? 0, patient_responsibility: money(e[5]) ?? 0, filing_indicator: clean(e[6]), payer_claim_id: clean(e[7]), facility_code: clean(e[8]), frequency: clean(e[9]), patient_name: null, member_id: null, insured_name: null, rendering_npi: null, statement_from: null, statement_to: null, received_date: null, adjustments: [], remarks: [], lines: [], segments: [s.n, s.n] };
        claims.push(claim); line = null; break;
      case 'CAS': {
        const adj = casAdjustments(e);
        if (line) line.adjustments.push(...adj); else if (claim) claim.adjustments.push(...adj); else p(s, 'cas_outside_claim', 'CAS before any CLP');
        break;
      }
      case 'NM1':
        if (!claim) break;
        if (clean(e[1]) === 'QC') { claim.patient_name = name(e); if (clean(e[9])) claim.member_id = clean(e[9]); }
        if (clean(e[1]) === 'IL') { claim.insured_name = name(e); if (clean(e[9])) claim.member_id = clean(e[9]); }
        if (clean(e[1]) === '82' && clean(e[8]) === 'XX') claim.rendering_npi = clean(e[9]);
        break;
      case 'MOA': if (claim) for (const i of [3, 4, 5, 6, 7]) if (clean(e[i])) claim.remarks.push(clean(e[i])); break;
      case 'MIA': if (claim) for (const i of [5, 20, 21, 22, 23]) if (clean(e[i])) claim.remarks.push(clean(e[i])); break;
      case 'SVC': {
        if (!claim) { p(s, 'svc_outside_claim', 'SVC before any CLP'); break; }
        const c = parts(e[1], comp); const orig = clean(e[6]) ? parts(e[6], comp) : null;
        line = { qualifier: c[0], code: c[1], modifiers: c.slice(2, 6).filter(Boolean), charge: money(e[2]) ?? 0, paid: money(e[3]) ?? 0, revenue_code: clean(e[4]) || (c[0] === 'NU' ? c[1] : null), units: plain(e[5]) ?? 1, billed_code: orig ? orig[1] : null, billed_units: plain(e[7]), date_from: null, date_to: null, allowed: null, adjustments: [], remarks: [], line_control: null };
        claim.lines.push(line); break;
      }
      case 'AMT': if (line && clean(e[1]) === 'B6') line.allowed = money(e[2]); else if (claim && !line && clean(e[1]) === 'AU') claim.coverage_amount = money(e[2]); break;
      case 'LQ': if (line && clean(e[1]) === 'HE') line.remarks.push(clean(e[2])); break;
      case 'PLB':
        for (let k = 0; k < 6; k++) {
          const r = clean(e[3 + 2 * k]); if (!r) continue;
          const [reason, ref] = parts(r, comp);
          plb.push({ provider_id: clean(e[1]), date: x12Date(e[2]), reason, reference: ref || null, amount: money(e[4 + 2 * k]) ?? 0 });
        }
        claim = null; line = null; break;
      case 'SE': break;
      default: break;
    }
    if (claim && s.id !== 'PLB') claim.segments[1] = s.n;
  }
  // Balancing (as the 835 guide describes it): a person can trust the totals only when these hold.
  for (const c of claims) {
    for (const l of c.lines) {
      const exp = Math.round((l.charge - sumAmt(l.adjustments)) * 100) / 100;
      if (Math.abs(exp - l.paid) > 0.005) p({ n: c.segments[0] }, 'line_out_of_balance', `claim ${c.claim_id} line ${l.code}: charge ${l.charge} − adjustments ${sumAmt(l.adjustments)} = ${exp}, but paid is ${l.paid}`);
    }
    const all = sumAmt(c.adjustments) + c.lines.reduce((s, l) => s + sumAmt(l.adjustments), 0);
    const exp = Math.round((c.charge - all) * 100) / 100;
    if (Math.abs(exp - c.paid) > 0.005) p({ n: c.segments[0] }, 'claim_out_of_balance', `claim ${c.claim_id}: charge ${c.charge} − adjustments ${Math.round(all * 100) / 100} = ${exp}, but paid is ${c.paid}`);
  }
  if (payment.amount !== null) {
    const exp = Math.round((claims.reduce((s, c) => s + c.paid, 0) - sumAmt(plb)) * 100) / 100;
    if (Math.abs(exp - payment.amount) > 0.005) p(null, 'payment_out_of_balance', `claim payments − provider adjustments = ${exp}, but BPR02 says ${payment.amount}`);
  }
  return { payment, claims, plb, problems };
}

// ------------------------------------------------------------------ 837 ----

/**
 * 837 (P, I or D) → { claims, problems }. Each claim carries its billing provider,
 * subscriber, patient, payer, diagnoses and service lines, plus the segment numbers
 * (counted from ST, as a 999 reports them) it spans.
 */
export function read837(tx, comp = ':') {
  const segs = tx.segments; const problems = [];
  const variant = /X222/.test(clean((segs.find((s) => s.id === 'ST') || { el: [] }).el[3])) ? 'professional' : /X223/.test(clean((segs.find((s) => s.id === 'ST') || { el: [] }).el[3])) ? 'institutional' : /X224/.test(clean((segs.find((s) => s.id === 'ST') || { el: [] }).el[3])) ? 'dental' : null;
  const claims = [];
  let level = null, billing = {}, subscriber = {}, patient = null, payer = {}, claim = null, line = null, nm1 = null, sbr = {}; let hl22 = null;
  const stStart = segs.length ? segs[0].n : 1;
  for (const s of segs) {
    const e = s.el; const pos = s.n - stStart + 1;
    switch (s.id) {
      case 'HL': {
        level = clean(e[3]); claim = null; line = null;
        if (level === '20') { billing = {}; }
        if (level === '22') { subscriber = {}; patient = null; payer = {}; sbr = {}; hl22 = pos; }
        if (level === '23') patient = {};
        break;
      }
      case 'SBR': sbr = { responsibility: clean(e[1]), relationship: clean(e[2]), group_number: clean(e[3]), filing_indicator: clean(e[9]) }; break;
      case 'PAT': if (patient) patient.relationship = clean(e[1]); break;
      case 'NM1': {
        nm1 = clean(e[1]);
        const who = { name: name(e), id_qualifier: clean(e[8]), id: clean(e[9]) };
        if (nm1 === '85') Object.assign(billing, { name: who.name, npi: who.id_qualifier === 'XX' ? who.id : null });
        else if (nm1 === 'IL') Object.assign(subscriber, { name: who.name, member_id: who.id || null });
        else if (nm1 === 'QC' && patient) Object.assign(patient, { name: who.name });
        else if (nm1 === 'PR') Object.assign(payer, { name: who.name, id: who.id || null });
        else if (claim && ['82', 'DN', '77', 'DQ', '71', '72', 'ZZ', 'DK'].includes(nm1)) {
          const key = { 82: 'rendering_npi', DN: 'referring_npi', 77: 'facility_npi', DQ: 'supervising_npi', 71: 'attending_npi', 72: 'operating_npi', DK: 'ordering_npi' }[nm1];
          if (key && who.id_qualifier === 'XX') (line || claim)[key] = who.id;
        }
        break;
      }
      case 'N3': { const t = nm1 === '85' ? billing : nm1 === 'IL' ? subscriber : nm1 === 'QC' && patient ? patient : null; if (t && !claim) t.address = [clean(e[1]), clean(e[2])].filter(Boolean).join(' '); break; }
      case 'N4': { const t = nm1 === '85' ? billing : nm1 === 'IL' ? subscriber : nm1 === 'QC' && patient ? patient : null; if (t && !claim) Object.assign(t, { city: clean(e[1]), state: clean(e[2]), zip: clean(e[3]) }); break; }
      case 'DMG': { const t = nm1 === 'QC' && patient ? patient : nm1 === 'IL' ? subscriber : null; if (t && clean(e[1]) === 'D8') Object.assign(t, { dob: x12Date(e[2]), gender: clean(e[3]) || null }); break; }
      case 'REF': {
        const q = clean(e[1]), v = clean(e[2]);
        if (!claim) { if (q === 'EI' && nm1 === '85') billing.tax_id = v; break; }
        const t = line || claim;
        if (q === 'G1') t.prior_auth = v; else if (q === '9F') t.referral = v; else if (q === 'F8') claim.original_ref = v; else if (q === 'D9') claim.clearinghouse_trace = v; else if (q === 'X4') t.clia = v; else if (q === '6R' && line) line.line_control = v; else if (q === 'EA') claim.mrn = v;
        break;
      }
      case 'CLM': {
        const c5 = parts(e[5], comp);
        const pat = patient && patient.name ? patient : null;
        claim = {
          claim_id: clean(e[1]), total_charge: money(e[2]) ?? 0, claim_type: variant || (c5[1] === 'A' ? 'institutional' : 'professional'),
          pos: c5[1] === 'B' || variant === 'professional' || variant === 'dental' ? c5[0] : null, facility_code: c5[1] === 'A' || variant === 'institutional' ? c5[0] : null, frequency: c5[2] || '1',
          provider_signature: clean(e[6]) || null, assignment: clean(e[7]) || null, benefits_assigned: clean(e[8]) || null, release_of_info: clean(e[9]) || null,
          payer_name: payer.name || null, payer_id: payer.id || null, filing_indicator: sbr.filing_indicator || null, payer_responsibility: sbr.responsibility || null, group_number: sbr.group_number || null,
          subscriber_name: subscriber.name || null, member_id: subscriber.member_id || null, subscriber_dob: subscriber.dob || null,
          patient_name: pat ? pat.name : subscriber.name || null, patient_dob: pat ? pat.dob || null : subscriber.dob || null, patient_gender: pat ? pat.gender || null : subscriber.gender || null,
          relationship: pat ? pat.relationship || null : sbr.relationship || '18', patient_address: (pat || subscriber).address || null, patient_zip: (pat || subscriber).zip || null,
          billing_npi: billing.npi || null, billing_name: billing.name || null, billing_tax_id: billing.tax_id || null,
          rendering_npi: null, referring_npi: null, prior_auth: null, original_ref: null, clia: null, diagnoses: [], statement_from: null, statement_to: null, admission_date: null, onset_date: null,
          lines: [], segments: [pos, pos], loop_start: hl22 ?? pos,
        };
        claims.push(claim); line = null; break;
      }
      case 'DTP': {
        const q = clean(e[1]); const pr = period(e[2], e[3]);
        if (line && q === '472') { line.date_from = pr.from; line.date_to = pr.to; }
        else if (claim && q === '434') { claim.statement_from = pr.from; claim.statement_to = pr.to; }
        else if (claim && q === '435') claim.admission_date = pr.from;
        else if (claim && q === '431') claim.onset_date = pr.from;
        else if (claim && q === '472' && !line) { claim.statement_from = claim.statement_from || pr.from; claim.statement_to = claim.statement_to || pr.to; }
        break;
      }
      case 'HI': if (claim && !line) for (const x of e.slice(1)) { const [q, code] = parts(x, comp); if (['ABK', 'ABF', 'BK', 'BF', 'ABJ', 'APR'].includes(q) && code) claim.diagnoses.push({ qualifier: q, code }); } break;
      case 'LX': if (claim) { line = { line: Number(clean(e[1])) || claim.lines.length + 1, qualifier: null, code: null, modifiers: [], charge: 0, units: null, unit_basis: null, pos: null, pointers: [], date_from: null, date_to: null, revenue_code: null, rendering_npi: null, tooth: null, surfaces: [], quadrant: null, segment: pos }; claim.lines.push(line); } break;
      case 'SV1': if (line) { const c = parts(e[1], comp); Object.assign(line, { qualifier: c[0], code: c[1], modifiers: c.slice(2, 6).filter(Boolean), charge: money(e[2]) ?? 0, unit_basis: clean(e[3]) || null, units: plain(e[4]), pos: clean(e[5]) || null, pointers: parts(e[7], comp).filter(Boolean).map(Number) }); } break;
      case 'SV2': if (line) { const c = parts(e[2], comp); Object.assign(line, { revenue_code: clean(e[1]), qualifier: c[0] || null, code: c[1] || null, modifiers: c.slice(2, 6).filter(Boolean), charge: money(e[3]) ?? 0, unit_basis: clean(e[4]) || null, units: plain(e[5]) }); } break;
      case 'SV3': if (line) { const c = parts(e[1], comp); const area = parts(e[4], comp).filter(Boolean); Object.assign(line, { qualifier: c[0], code: c[1], modifiers: c.slice(2, 6).filter(Boolean), charge: money(e[2]) ?? 0, pos: clean(e[3]) || null, units: plain(e[6]) ?? 1, quadrant: area[0] || null }); } break;
      case 'TOO': if (line) { line.tooth = clean(e[2]) || null; line.surfaces = parts(e[3], comp).filter(Boolean); } break;
      default: break;
    }
    if (claim) claim.segments[1] = pos;
  }
  for (const c of claims) {
    const sum = Math.round(c.lines.reduce((t, l) => t + (l.charge || 0), 0) * 100) / 100;
    c.lines_total = sum;
    if (c.lines.length && Math.abs(sum - c.total_charge) > 0.005) problems.push({ segment: null, code: 'claim_total_mismatch', message: `claim ${c.claim_id}: CLM02 is ${c.total_charge}, lines add up to ${sum}` });
    const dates = c.lines.map((l) => l.date_from).filter(Boolean).sort();
    c.service_from = dates[0] || c.statement_from || null; c.service_to = dates.at(-1) || c.statement_to || c.service_from;
  }
  return { variant, claims, problems };
}

// ------------------------------------------------------------------ 999 ----

export const IK5_STATUS = Object.freeze({ A: 'accepted', E: 'accepted_with_errors', M: 'rejected', R: 'rejected', W: 'rejected', X: 'rejected' });

/** 999 → { sets: [{ set, control, status, accepted, errors }], groups }. */
export function read999(tx) {
  const sets = []; const groups = []; let cur = null, seg = null; let group = null;
  for (const s of tx.segments) {
    const e = s.el;
    if (s.id === 'AK1') group = { functional: clean(e[1]), control: clean(e[2]), version: clean(e[3]) };
    if (s.id === 'AK2') { cur = { set: clean(e[1]), control: clean(e[2]), group_control: group ? group.control : null, status: null, accepted: null, errors: [] }; sets.push(cur); seg = null; }
    if (s.id === 'IK3' && cur) { seg = { segment_id: clean(e[1]), position: plain(e[2]), loop: clean(e[3]) || null, code: clean(e[4]), elements: [] }; cur.errors.push(seg); }
    if (s.id === 'IK4' && cur) { const el = { position: clean(e[1]), element_ref: clean(e[2]) || null, code: clean(e[3]), bad_value: clean(e[4]) || null }; if (seg) seg.elements.push(el); else cur.errors.push({ segment_id: null, position: null, loop: null, code: null, elements: [el] }); }
    if (s.id === 'IK5' && cur) { cur.status_code = clean(e[1]); cur.status = IK5_STATUS[clean(e[1])] || clean(e[1]); cur.accepted = ['A', 'E'].includes(clean(e[1])); cur.reason_codes = e.slice(2).map(clean).filter(Boolean); }
    if (s.id === 'AK9' && group) groups.push({ ...group, status: clean(e[1]), included: plain(e[2]), received: plain(e[3]), accepted: plain(e[4]) });
  }
  return { sets, groups };
}

// ------------------------------------------------------------------ 277 ----

const STC_CATEGORY = Object.freeze({ A0: 'forwarded', A1: 'received', A2: 'accepted', A3: 'returned_unprocessable', A4: 'not_found', A5: 'split', A6: 'rejected_missing_info', A7: 'rejected_invalid_info', A8: 'rejected_relational_error' });
export const STC_CATEGORIES = STC_CATEGORY;
const REJECTED = new Set(['A3', 'A4', 'A6', 'A7', 'A8']);

/** 277 / 277CA → { claims: [{ claim_id, payer_claim_id, patient_name, statuses, category, rejected, charge, date, service_from, service_to }] }. */
export function read277(tx, comp = ':') {
  const claims = []; let level = null, payer = null, provider_npi = null, cur = null; let nm1 = null; let pendingName = null;
  for (const s of tx.segments) {
    const e = s.el;
    if (s.id === 'HL') { level = clean(e[3]); cur = null; pendingName = null; }
    if (s.id === 'NM1') { nm1 = clean(e[1]); if (nm1 === 'PR') payer = name(e); if (nm1 === '85' && clean(e[8]) === 'XX') provider_npi = clean(e[9]); if (nm1 === 'QC' || nm1 === 'IL') pendingName = { name: name(e), member_id: clean(e[9]) || null }; }
    if (s.id === 'TRN' && clean(e[1]) === '2' && ['PT', '23', '22'].includes(level)) {
      cur = { claim_id: clean(e[2]), payer_claim_id: null, clearinghouse_trace: null, patient_name: pendingName ? pendingName.name : null, member_id: pendingName ? pendingName.member_id : null, payer, provider_npi, statuses: [], category: null, rejected: false, charge: null, date: null, service_from: null, service_to: null, segment: s.n };
      claims.push(cur);
    }
    if (s.id === 'STC' && cur) {
      for (const idx of [1, 10, 11]) {
        const c = parts(e[idx], comp); if (!c[0]) continue;
        cur.statuses.push({ category: c[0], status: c[1] || null, entity: c[2] || null, meaning: STC_CATEGORY[c[0]] || null });
      }
      cur.category = cur.category || (cur.statuses[0] && cur.statuses[0].category) || null;
      cur.rejected = cur.statuses.some((x) => REJECTED.has(x.category));
      cur.date = cur.date || x12Date(e[2]); cur.action = clean(e[3]) || null; cur.charge = cur.charge ?? money(e[4]);
    }
    if (s.id === 'REF' && cur) { if (clean(e[1]) === '1K') cur.payer_claim_id = clean(e[2]); if (clean(e[1]) === 'D9') cur.clearinghouse_trace = clean(e[2]); if (clean(e[1]) === 'EJ' && !cur.claim_id) cur.claim_id = clean(e[2]); }
    if (s.id === 'DTP' && cur && clean(e[1]) === '472') { const pr = period(e[2], e[3]); cur.service_from = pr.from; cur.service_to = pr.to; }
  }
  return { claims };
}

// ------------------------------------------------------------------ 271 ----

export const EB_CODES = Object.freeze({ 1: 'active', 2: 'active_full_risk_capitation', 3: 'services_capitated', 4: 'capitated_to_pcp', 5: 'conditional_active', 6: 'inactive', 7: 'inactive_pending_update', 8: 'inactive_pending_investigation', A: 'coinsurance', B: 'copayment', C: 'deductible', D: 'benefit_description', E: 'exclusions', F: 'limitations', G: 'out_of_pocket', I: 'non_covered', L: 'primary_care_provider', R: 'other_payer', U: 'contact_entity', V: 'cannot_process', X: 'facility' });

/** 271 → { members: [{ trace, payer, name, member_id, dob, active, plan_begin, plan_end, benefits, rejections, other_payers }] }. */
export function read271(tx, comp = ':') {
  const members = []; let payer = null, cur = null, nm1 = null, lastEb = null; const pending = [];
  for (const s of tx.segments) {
    const e = s.el;
    if (s.id === 'HL') { const lv = clean(e[3]); if (lv === '22' || lv === '23') { cur = { level: lv === '22' ? 'subscriber' : 'dependent', trace: null, payer, name: null, member_id: null, dob: null, gender: null, active: null, plan_begin: null, plan_end: null, benefits: [], rejections: [], other_payers: [], group_number: null }; members.push(cur); lastEb = null; } }
    if (s.id === 'NM1') {
      nm1 = clean(e[1]);
      if (nm1 === 'PR' && !cur) payer = name(e);
      else if (cur && ['IL', '03'].includes(nm1) && !lastEb) { cur.name = name(e); if (clean(e[9])) cur.member_id = clean(e[9]); }
      else if (cur && lastEb && lastEb.code === 'R') cur.other_payers.push({ name: name(e), id: clean(e[9]) || null });
    }
    if (s.id === 'TRN' && cur && !cur.trace) cur.trace = clean(e[2]);
    if (s.id === 'REF' && cur && clean(e[1]) === '6P') cur.group_number = clean(e[2]);
    if (s.id === 'DMG' && cur && clean(e[1]) === 'D8') { cur.dob = x12Date(e[2]); cur.gender = clean(e[3]) || null; }
    if (s.id === 'DTP' && cur) {
      const q = clean(e[1]); const pr = period(e[2], e[3]);
      if (q === '291' || q === '307') { if (!lastEb) { cur.plan_begin = cur.plan_begin || pr.from; if (clean(e[2]) === 'RD8') cur.plan_end = cur.plan_end || pr.to; } else { lastEb.from = pr.from; lastEb.to = pr.to; } }
      if (q === '346') cur.plan_begin = pr.from;
      if (q === '347') cur.plan_end = pr.from;
    }
    if (s.id === 'AAA') { const r = { valid_request: clean(e[1]), code: clean(e[3]), action: clean(e[4]) }; if (cur) cur.rejections.push(r); else pending.push(r); }
    if (s.id === 'EB' && cur) {
      const code = clean(e[1]);
      lastEb = { code, meaning: EB_CODES[code] || null, level: clean(e[2]) || null, service_types: clean(e[3]).split(/\^|,/).map(clean).filter(Boolean), insurance_type: clean(e[4]) || null, plan: clean(e[5]) || null, period: clean(e[6]) || null, amount: money(e[7]), percent: plain(e[8]), in_network: clean(e[12]) || null };
      cur.benefits.push(lastEb);
      if (['1', '2', '3', '4', '5'].includes(code)) cur.active = true;
      else if (['6', '7', '8'].includes(code) && cur.active !== true) cur.active = false;
    }
    if (s.id === 'MSG' && lastEb) lastEb.message = clean(e[1]).slice(0, 200);
  }
  if (pending.length && !members.length) members.push({ level: 'request', trace: null, payer, name: null, member_id: null, dob: null, active: null, plan_begin: null, plan_end: null, benefits: [], rejections: pending, other_payers: [] });
  return { members };
}

// ------------------------------------------------------------------ 278 ----

export const HCR_ACTIONS = Object.freeze({ A1: 'certified', A2: 'certified_partial', A3: 'not_certified', A4: 'pended', A6: 'modified', C: 'cancelled', CT: 'contact_payer', NA: 'no_action_required' });

/** 278 response → { reviews: [{ trace, patient_name, member_id, decision, decision_code, auth_number, from, to, codes, units, service_type }] }. */
export function read278(tx, comp = ':') {
  const reviews = []; let pat = null, cur = null; let nm1 = null;
  for (const s of tx.segments) {
    const e = s.el;
    if (s.id === 'HL' && ['EV', 'SS'].includes(clean(e[3]))) { if (clean(e[3]) === 'EV' || !cur) { cur = { trace: null, patient_name: pat ? pat.name : null, member_id: pat ? pat.member_id : null, decision: null, decision_code: null, auth_number: null, from: null, to: null, codes: [], units: null, service_type: null, segment: s.n }; reviews.push(cur); } }
    if (s.id === 'NM1') { nm1 = clean(e[1]); if (['IL', 'QC'].includes(nm1)) { pat = { name: name(e), member_id: clean(e[9]) || null }; if (cur) { cur.patient_name = cur.patient_name || pat.name; cur.member_id = cur.member_id || pat.member_id; } } }
    if (!cur) continue;
    if (s.id === 'TRN' && !cur.trace) cur.trace = clean(e[2]);
    if (s.id === 'UM') cur.service_type = clean(e[3]) || cur.service_type;
    if (s.id === 'HCR') { cur.decision_code = clean(e[1]); cur.decision = HCR_ACTIONS[clean(e[1])] || clean(e[1]); if (clean(e[2])) cur.auth_number = clean(e[2]); }
    if (s.id === 'REF' && ['BB', 'NT'].includes(clean(e[1])) && !cur.auth_number) cur.auth_number = clean(e[2]);
    if (s.id === 'DTP' && ['472', 'AAH'].includes(clean(e[1]))) { const pr = period(e[2], e[3]); cur.from = pr.from; cur.to = pr.to; }
    if (s.id === 'SV1' || s.id === 'SV2') { const c = parts(s.id === 'SV1' ? e[1] : e[2], comp); if (c[1]) cur.codes.push(c[1]); const u = plain(s.id === 'SV1' ? e[4] : e[5]); if (u !== null) cur.units = (cur.units || 0) + u; }
    if (s.id === 'HSD' && plain(e[2]) !== null && cur.units === null) cur.units = plain(e[2]);
  }
  return { reviews };
}

// --------------------------------------------------------------- dispatch ----

const READERS = { 835: read835, 837: read837, 999: read999, 277: read277, 271: read271, 278: read278 };

/** True when text starts like an X12 interchange (after a BOM and whitespace). */
export const looksX12 = (text) => /^\s*﻿?\s*ISA./.test(String(text).slice(0, 200));

/**
 * Read any supported healthcare X12 file. Returns { sets: ['835', ...], interchanges, problems,
 * by_set: { '835': [result per transaction], ... }, skipped_sets }.
 */
export function readHealthcareX12(text, { maxTransactions } = {}) {
  const parsed = parseX12(text, { maxTransactions });
  const comp = parsed.delimiters.component || ':';
  const by = {}; const skipped = {}; const problems = parsed.problems.slice();
  for (const tx of parsed.transactions) {
    const r = READERS[tx.set];
    if (!r) { skipped[tx.set] = (skipped[tx.set] || 0) + 1; continue; }
    const out = r(tx, comp);
    for (const pr of out.problems || []) problems.push({ ...pr, set: tx.set, control: tx.control });
    (by[tx.set] = by[tx.set] || []).push({ control: tx.control, group: tx.group, ...out });
  }
  return { sets: Object.keys(by), interchanges: parsed.interchanges, problems, by_set: by, skipped_sets: skipped };
}

// ---------------------------------------------------------------- writer ----

/**
 * Build an X12 interchange from transaction bodies, with correct control numbers and
 * counts. For fixtures, tests and the scale bench (it writes fictional data only).
 * transactions: [{ set: '835', version: '005010X221A1', segments: [['BPR', 'I', '100'], ...] }]
 * Each segment is an array of elements; an element that is an array is joined with ':'.
 */
export function buildX12(transactions, { sender = 'SENDER', receiver = 'RECEIVER', date = '20260101', time = '1200', control = 1, functional = 'HP', usage = 'T' } = {}) {
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  const seg = (els) => els.map((x) => (Array.isArray(x) ? x.join(':') : x ?? '')).join('*').replace(/\*+$/, '') + '~';
  const isaCtl = String(control).padStart(9, '0');
  const out = [`ISA*00*${pad('', 10)}*00*${pad('', 10)}*ZZ*${pad(sender, 15)}*ZZ*${pad(receiver, 15)}*${date.slice(2)}*${time}*^*00501*${isaCtl}*0*${usage}*:~`];
  const byGroup = new Map();
  for (const tx of transactions) { const f = tx.functional || { 835: 'HP', 837: 'HC', 999: 'FA', 277: 'HN', 271: 'HB', 278: 'HI' }[tx.set] || functional; if (!byGroup.has(f)) byGroup.set(f, []); byGroup.get(f).push(tx); }
  let g = 0;
  for (const [f, list] of byGroup) {
    g++;
    out.push(seg(['GS', f, sender, receiver, date, time, String(g), 'X', list[0].version || '005010']));
    list.forEach((tx, i) => {
      const ctl = String(i + 1).padStart(4, '0');
      const body = [['ST', tx.set, ctl, tx.version || '005010'], ...tx.segments];
      out.push(...body.map(seg));
      out.push(seg(['SE', String(body.length + 1), ctl]));
    });
    out.push(seg(['GE', String(list.length), String(g)]));
  }
  out.push(seg(['IEA', String(byGroup.size), isaCtl]));
  return out.join('\n') + '\n';
}
