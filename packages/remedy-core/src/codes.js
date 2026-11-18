// Code tables the Remedy agents share: claim adjustment group codes, the common
// Claim Adjustment Reason Codes (CARC) and Remittance Advice Remark Codes (RARC)
// with the root-cause category each one usually points to, 835 claim status codes,
// place-of-service codes, provider-level adjustment reasons and modifier facts.
//
// The descriptions are SHORT PARAPHRASES written from knowledge of the public lists
// (X12 maintains CARC and RARC; CMS maintains place of service). They are not the
// official wording and were not checked against the current lists. Codes are added
// and retired several times a year: a code that is not here is reported as
// "unknown code, look it up", never guessed. A buyer can add or override entries
// in the agent config (reason_codes) and, where an agent has memory, teach a
// payer-specific mapping that a named person accepts.

export const CODE_TABLES_NOTE = 'Reason, remark and place-of-service descriptions are short paraphrases of the public lists as we recall them, not the official text, and were not checked against the current releases. Unknown codes are reported as unknown, never guessed.';

/** Claim adjustment group codes (CAS01). */
export const GROUP_CODES = Object.freeze({
  CO: 'Contractual obligation (provider write-off unless appealed)',
  PR: 'Patient responsibility (bill the patient or secondary)',
  OA: 'Other adjustment',
  PI: 'Payer-initiated reduction',
  CR: 'Correction or reversal of an earlier claim',
});

/**
 * Root-cause categories a denial worklist sorts into. Each has a plain next step.
 * 'not_denial' covers contractual write-downs and patient cost-sharing, which are
 * expected adjustments rather than denials.
 */
export const DENIAL_CATEGORIES = Object.freeze({
  eligibility: { label: 'Eligibility or coverage', team: 'front desk / registration', next: 'Check coverage on the date of service, correct the payer or member id, and rebill the right payer.' },
  registration: { label: 'Registration or demographics', team: 'front desk / registration', next: 'Correct the patient or subscriber details (name, id, birth date, relationship) and resubmit.' },
  authorization: { label: 'Prior authorization or referral', team: 'authorization team', next: 'Find the authorization or referral number; if none was obtained, ask about a retro-authorization or appeal.' },
  coding: { label: 'Coding (code, modifier, diagnosis)', team: 'coding', next: 'Review the codes, modifiers and diagnosis pairing against the record; correct and resubmit as a corrected claim.' },
  bundling: { label: 'Bundling or code-pair edit', team: 'coding', next: 'Check whether a modifier is supported by the record (for example a distinct procedure); otherwise accept the edit.' },
  medical_necessity: { label: 'Medical necessity', team: 'coding / clinical', next: 'Check the diagnosis supports the service under the payer policy; appeal with records if it does.' },
  documentation: { label: 'Missing information or records', team: 'billing', next: 'Send the information or records the payer asked for, or correct the missing claim data.' },
  timely_filing: { label: 'Timely filing', team: 'billing', next: 'Look for proof of timely submission (clearinghouse acceptance report); appeal with it, otherwise write off per policy.' },
  duplicate: { label: 'Duplicate claim', team: 'billing', next: 'Check whether the original claim was paid or is pending; do not resubmit duplicates; use a corrected claim (frequency 7) if needed.' },
  coordination_of_benefits: { label: 'Coordination of benefits', team: 'billing / registration', next: 'Confirm primary and secondary coverage with the patient; bill the primary first, then the secondary with the primary remittance.' },
  provider_enrollment: { label: 'Provider enrolment or credentialing', team: 'credentialing', next: 'Check the rendering provider is enrolled with this payer on the date of service; fix the enrolment and rebill.' },
  non_covered: { label: 'Non-covered service or benefit limit', team: 'billing', next: 'Check the plan benefits; bill the patient only where a valid waiver or policy allows.' },
  pricing: { label: 'Pricing or fee schedule', team: 'payment posting / contracts', next: 'Compare the allowed amount with the contracted rate; request reprocessing if it is short.' },
  payer_error: { label: 'Payer processing or reversal', team: 'payment posting', next: 'Check the reversal and the reprocessed claim; call the payer if the claim was not reprocessed.' },
  not_denial: { label: 'Expected adjustment (not a denial)', team: 'payment posting', next: 'Post it; no action unless the amount is wrong.' },
  unknown: { label: 'Unknown code', team: 'billing', next: 'Look the code up in the current CARC/RARC list and the payer remittance guide, then teach the mapping.' },
});

const c = (category, text) => Object.freeze({ category, text });

/** Common CARCs → root-cause category and a short paraphrase. Not the full list. */
export const CARC = Object.freeze({
  1: c('not_denial', 'Deductible amount'),
  2: c('not_denial', 'Coinsurance amount'),
  3: c('not_denial', 'Co-payment amount'),
  4: c('coding', 'Procedure code inconsistent with the modifier, or a required modifier is missing'),
  5: c('coding', 'Procedure code or bill type inconsistent with the place of service'),
  6: c('coding', 'Procedure or revenue code inconsistent with the patient\'s age'),
  7: c('coding', 'Procedure or revenue code inconsistent with the patient\'s gender'),
  9: c('coding', 'Diagnosis inconsistent with the patient\'s age'),
  10: c('coding', 'Diagnosis inconsistent with the patient\'s gender'),
  11: c('coding', 'Diagnosis inconsistent with the procedure'),
  15: c('authorization', 'Authorization number missing, invalid or does not apply to the billed service or provider'),
  16: c('documentation', 'Claim or service lacks information or has submission or billing errors'),
  18: c('duplicate', 'Exact duplicate claim or service'),
  19: c('coordination_of_benefits', 'Work-related injury: bill the workers\' compensation carrier'),
  20: c('coordination_of_benefits', 'Injury covered by liability carrier'),
  22: c('coordination_of_benefits', 'Care may be covered by another payer per coordination of benefits'),
  23: c('coordination_of_benefits', 'Impact of prior payer adjudication, including payments and adjustments'),
  24: c('not_denial', 'Charges covered under a capitation agreement or managed care plan'),
  26: c('eligibility', 'Expenses incurred before coverage started'),
  27: c('eligibility', 'Expenses incurred after coverage ended'),
  29: c('timely_filing', 'Time limit for filing has expired'),
  31: c('registration', 'Patient cannot be identified as our insured'),
  32: c('registration', 'Our records show the patient is not an eligible dependent'),
  39: c('authorization', 'Services denied at the time authorization or pre-certification was requested'),
  45: c('not_denial', 'Charge exceeds fee schedule or maximum allowable (contractual write-down)'),
  49: c('non_covered', 'Routine or preventive service not covered with this diagnosis or frequency'),
  50: c('medical_necessity', 'Not deemed a medical necessity by the payer'),
  55: c('non_covered', 'Procedure or treatment considered experimental or investigational'),
  59: c('bundling', 'Processed under multiple or concurrent procedure rules'),
  96: c('non_covered', 'Non-covered charge'),
  97: c('bundling', 'Payment included in the allowance for another service already adjudicated'),
  100: c('not_denial', 'Payment made to the patient, insured or responsible party'),
  109: c('eligibility', 'Claim or service not covered by this payer; send to the correct payer'),
  119: c('non_covered', 'Benefit maximum for this period or occurrence has been reached'),
  125: c('documentation', 'Submission or billing error'),
  129: c('documentation', 'Prior processing information appears incorrect'),
  140: c('registration', 'Patient or insured health id number and name do not match'),
  146: c('coding', 'Diagnosis was invalid for the date of service'),
  150: c('medical_necessity', 'Information submitted does not support this level of service'),
  151: c('medical_necessity', 'Information submitted does not support this many or this frequency of services'),
  167: c('non_covered', 'Diagnosis or diagnoses are not covered'),
  170: c('provider_enrollment', 'Payment denied when performed or billed by this type of provider'),
  181: c('coding', 'Procedure code was invalid on the date of service'),
  182: c('coding', 'Procedure modifier was invalid on the date of service'),
  185: c('provider_enrollment', 'Rendering provider not eligible to perform the service billed'),
  189: c('coding', '"Not otherwise classified" or unlisted code used when a specific code exists'),
  197: c('authorization', 'Pre-certification, authorization or notification absent'),
  198: c('authorization', 'Pre-certification, notification or authorization exceeded'),
  199: c('coding', 'Revenue code and procedure code do not match'),
  204: c('non_covered', 'Service, equipment or drug not covered under the patient\'s current benefit plan'),
  206: c('documentation', 'National Provider Identifier missing'),
  207: c('documentation', 'National Provider Identifier invalid'),
  208: c('provider_enrollment', 'National Provider Identifier not matched'),
  226: c('documentation', 'Information requested from the billing or rendering provider was not provided or was insufficient'),
  227: c('documentation', 'Information requested from the patient or insured was not provided or was insufficient'),
  234: c('bundling', 'This procedure is not paid separately'),
  236: c('bundling', 'Procedure or procedure and modifier combination is not compatible with another procedure on the same day (code-pair edit)'),
  242: c('provider_enrollment', 'Services not provided by network or primary care providers'),
  252: c('documentation', 'An attachment or other documentation is required to adjudicate this claim'),
  253: c('not_denial', 'Sequestration reduction in federal payment'),
  B7: c('provider_enrollment', 'Provider was not certified or eligible to be paid for this procedure on this date'),
  B9: c('eligibility', 'Patient is enrolled in a hospice'),
  B11: c('eligibility', 'Claim transferred to the proper payer or processor'),
  B13: c('duplicate', 'Previously paid; payment for this claim or service may have been provided in a previous payment'),
  B15: c('bundling', 'Service requires a qualifying service or procedure that was not received or not paid'),
  B16: c('coding', '"New patient" qualifications were not met'),
  B20: c('duplicate', 'Procedure or service was partially or fully furnished by another provider'),
});

/** Common RARCs (remark codes) → short paraphrase and a category hint. */
export const RARC = Object.freeze({
  M15: c('bundling', 'Separately billed services or tests were bundled; payment is in another service'),
  M20: c('documentation', 'Missing, incomplete or invalid HCPCS code'),
  M51: c('documentation', 'Missing, incomplete or invalid procedure code'),
  M76: c('documentation', 'Missing, incomplete or invalid diagnosis or condition'),
  M77: c('documentation', 'Missing, incomplete or invalid place of service'),
  M80: c('bundling', 'Not covered when performed during the same session or date as another service'),
  M86: c('duplicate', 'Service denied because payment was already made for the same or a similar procedure'),
  MA04: c('coordination_of_benefits', 'Secondary payment cannot be considered without the primary payer\'s remittance'),
  MA130: c('documentation', 'Claim has missing or invalid information and cannot be processed; resubmit it as a new claim'),
  N20: c('bundling', 'Service not payable with other service rendered on the same date'),
  N30: c('eligibility', 'Patient ineligible for this service'),
  N56: c('coding', 'Procedure code billed is not correct or valid for the services billed or the date of service'),
  N115: c('medical_necessity', 'Decision based on a local coverage determination'),
  N130: c('non_covered', 'Consult plan benefit documents or guidelines for coverage restrictions'),
  N290: c('documentation', 'Missing, incomplete or invalid rendering provider primary identifier'),
  N362: c('coding', 'Number of units exceeds the acceptable maximum (units edit)'),
});

/** 835 CLP02 claim status codes. */
export const CLAIM_STATUS = Object.freeze({
  1: 'Processed as primary', 2: 'Processed as secondary', 3: 'Processed as tertiary', 4: 'Denied',
  19: 'Processed as primary, forwarded to additional payer(s)', 20: 'Processed as secondary, forwarded to additional payer(s)',
  21: 'Processed as tertiary, forwarded to additional payer(s)', 22: 'Reversal of previous payment', 23: 'Not our claim, forwarded to additional payer(s)', 25: 'Predetermination pricing only, no payment',
});

/** PLB provider-level adjustment reasons (PLB03-1), the common ones. */
export const PLB_REASONS = Object.freeze({
  '50': 'Late charge', '51': 'Interest penalty charge', '72': 'Authorized return (refund adjustment)', '90': 'Early payment allowance', AH: 'Origination fee', AM: 'Applied to borrower\'s account', AP: 'Acceleration of benefits', B2: 'Rebate', B3: 'Recovery allowance', BD: 'Bad debt adjustment', BN: 'Bonus', C5: 'Temporary allowance', CR: 'Capitation interest', CS: 'Adjustment', CT: 'Capitation payment', CV: 'Capital passthru', CW: 'Certified registered nurse anesthetist passthru', DM: 'Direct medical education passthru', E3: 'Withholding', FB: 'Forwarding balance', FC: 'Fund allocation', GO: 'Graduate medical education passthru', HM: 'Hemophilia clotting factor supplement', IP: 'Incentive premium payment', IR: 'Internal Revenue Service withholding', IS: 'Interim settlement', J1: 'Nonreimbursable', L3: 'Penalty', L6: 'Interest owed', LE: 'Levy', LS: 'Lump sum', OA: 'Organ acquisition passthru', OB: 'Offset for affiliated providers', PI: 'Periodic interim payment', PL: 'Payment final', RA: 'Retro-activity adjustment', RE: 'Return on equity', SL: 'Student loan repayment', TL: 'Third party liability', WO: 'Overpayment recovery', WU: 'Unspecified recovery',
});

/** Place-of-service codes (CMS list), the ones billing teams meet most. */
export const POS = Object.freeze({
  '01': 'Pharmacy', '02': 'Telehealth provided other than in the patient\'s home', '03': 'School', '04': 'Homeless shelter', '10': 'Telehealth provided in the patient\'s home', '11': 'Office', '12': 'Home', '13': 'Assisted living facility', '14': 'Group home', '15': 'Mobile unit', '17': 'Walk-in retail health clinic', '19': 'Off campus outpatient hospital', '20': 'Urgent care facility', '21': 'Inpatient hospital', '22': 'On campus outpatient hospital', '23': 'Emergency room, hospital', '24': 'Ambulatory surgical center', '31': 'Skilled nursing facility', '32': 'Nursing facility', '33': 'Custodial care facility', '34': 'Hospice', '41': 'Ambulance, land', '42': 'Ambulance, air or water', '49': 'Independent clinic', '50': 'Federally qualified health center', '51': 'Inpatient psychiatric facility', '52': 'Psychiatric facility, partial hospitalization', '53': 'Community mental health center', '54': 'Intermediate care facility for individuals with intellectual disabilities', '55': 'Residential substance abuse treatment facility', '56': 'Psychiatric residential treatment center', '57': 'Non-residential substance abuse treatment facility', '60': 'Mass immunization center', '61': 'Comprehensive inpatient rehabilitation facility', '62': 'Comprehensive outpatient rehabilitation facility', '65': 'End-stage renal disease treatment facility', '71': 'Public health clinic', '72': 'Rural health clinic', '81': 'Independent laboratory', '99': 'Other place of service',
});

/** Claim frequency codes (CLM05-3). */
export const FREQUENCY = Object.freeze({ 1: 'Original claim', 7: 'Replacement (corrected) claim', 8: 'Void or cancel of a prior claim' });

/** Modifier facts the coding agents use (format and pairing only; no payment rules). */
export const MODIFIERS = Object.freeze({
  pairs_that_conflict: [['26', 'TC'], ['LT', 'RT'], ['50', 'LT'], ['50', 'RT'], ['QK', 'AA'], ['QY', 'AA'], ['QK', 'QY'], ['QX', 'QZ'], ['AA', 'QZ'], ['GA', 'GZ'], ['25', '57'], ['NU', 'RR'], ['NU', 'UE'], ['RR', 'UE']],
  distinct: ['59', 'XE', 'XS', 'XP', 'XU'],
  anesthesia: { AA: 'Personally performed by an anesthesiologist', QK: 'Medical direction of 2 to 4 concurrent procedures', QX: 'CRNA service with medical direction', QY: 'Medical direction of one CRNA', QZ: 'CRNA service without medical direction', AD: 'Medical supervision of more than 4 concurrent procedures', G8: 'Monitored anesthesia care for deep complex procedure', G9: 'Monitored anesthesia care for patient with history of severe cardio-pulmonary condition', QS: 'Monitored anesthesia care service', '23': 'Unusual anesthesia' },
  telehealth: { '95': 'Synchronous telemedicine via real-time audio and video', '93': 'Synchronous telemedicine via audio only', GT: 'Via interactive audio and video (older code)', GQ: 'Via asynchronous telecommunications', FQ: 'Service furnished using audio-only communication', FR: 'Supervising practitioner present through real-time audio and video' },
  dme: { NU: 'New equipment', RR: 'Rental', UE: 'Used durable equipment', KX: 'Requirements in the medical policy have been met', KH: 'Initial claim, first month rental', KI: 'Second or third month rental', KJ: 'Months four to fifteen of a capped rental', MS: 'Maintenance and servicing', RA: 'Replacement of an item', RB: 'Replacement of a part as part of repair' },
  labs: { QW: 'CLIA-waived test', '90': 'Reference (outside) laboratory', '91': 'Repeat clinical diagnostic laboratory test', GA: 'Waiver of liability statement (ABN) on file', GZ: 'Item or service expected to be denied as not reasonable and necessary, no ABN', GY: 'Item or service statutorily excluded' },
});

/** Category and text for one reason code, or the unknown category. Overrides win. */
export function reasonInfo(code, { overrides = {}, remark = false } = {}) {
  const k = String(code ?? '').trim().toUpperCase().replace(/^0+(?=\d)/, '');
  if (overrides[k]) {
    // A config may give just the category ("197": "documentation") or an object with category and text.
    const o = typeof overrides[k] === 'string' ? { category: overrides[k] } : overrides[k];
    const t = remark ? RARC[k] : CARC[k];
    return { code: k, known: true, source: 'config', category: o.category || (t ? t.category : 'unknown'), text: o.text || (t ? t.text : `Reason code ${k} (category from your config)`) };
  }
  const t = remark ? RARC[k] : CARC[k];
  return t ? { code: k, known: true, source: 'built_in', category: t.category, text: t.text } : { code: k, known: false, source: null, category: 'unknown', text: `Unknown ${remark ? 'remark' : 'reason'} code ${k}: look it up in the current ${remark ? 'RARC' : 'CARC'} list` };
}
