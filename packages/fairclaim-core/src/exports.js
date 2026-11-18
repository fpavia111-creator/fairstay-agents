// Catalogue of export files from real systems that the Fairclaim agents recognise.
// The X12 files (835, 837, 999, 277CA, 271, 278) are read by hc-x12.js, not here.
//
// Each entry says how to recognise the file (column names that must be there).
// An agent turns an entry into a profile by adding its own column map:
//
//   exportProfile('slack_members', { user: 'fullname', email: 'email' })
//
// basis:
//   'documented'  the column names were checked against the vendor's own
//                 documentation (source and date given);
//   'recalled'    the layout was written from knowledge of the export and was
//                 not checked against documentation or a live account.
// Neither kind was tested against a live account. When a header differs, the
// file still maps by each column's "also called" list, `inspect` shows what was
// matched, and remedy-sources.json names the columns by hand.

const e = (id, system, label, signature, extra = {}) => Object.freeze({ id, system, label, signature, basis: 'recalled', ...extra });

export const EXPORTS = Object.freeze(Object.fromEntries([
  // Public CMS files (layouts published by CMS; see each entry's basis)
  e('cms_ncci_ptp', 'CMS NCCI', 'Procedure-to-procedure edits, practitioner file', ['Column 1', 'Column 2', 'Effective Date', ['Deletion Date', 'Deletion Date *=no data']]),
  e('cms_ncci_mue', 'CMS NCCI', 'Medically unlikely edits, practitioner services table', ['HCPCS/CPT Code', 'Practitioner Services MUE Values']),
  e('cms_pfs_rvu', 'CMS Physician Fee Schedule', 'PPRRVU relative value file', ['HCPCS', 'MOD', 'WORK RVU', 'MP RVU']),
  e('cms_pfs_gpci', 'CMS Physician Fee Schedule', 'Geographic practice cost index file', ['Locality Name', 'PE GPCI', 'MP GPCI']),
  e('cms_pfs_indicators', 'CMS Physician Fee Schedule', 'pfs.data.cms.gov indicators file (CSV)', ['hcpc', 'modifier', 'rvu_work', 'full_nfac_pe', 'rvu_mp', 'conv_fact'], { basis: 'documented', source: 'pfs.data.cms.gov indicators2026-09-01.csv column list', checked: '2026-11-16' }),
  e('cms_pfs_localities', 'CMS Physician Fee Schedule', 'pfs.data.cms.gov localities file (CSV)', ['gpci_work', 'gpci_pe', 'gpci_mp', 'locality'], { basis: 'documented', source: 'pfs.data.cms.gov localities2026-01-01-2026.csv column list', checked: '2026-11-16' }),
  e('cms_hpt_csv_tall', 'CMS hospital price transparency', 'Machine-readable file, CSV tall template v2.x', ['description', 'setting', 'standard_charge|gross', 'standard_charge|discounted_cash', 'payer_name'], { basis: 'documented', source: 'github.com/CMSgov/hospital-price-transparency V2.0.0_Tall_CSV_Format_Template.csv', checked: '2026-11-16' }),
  e('cms_hpt_csv_tall_v3', 'CMS hospital price transparency', 'Machine-readable file, CSV tall template v3.0', ['description', 'setting', 'standard_charge|gross', 'median_amount', '10th_percentile'], { basis: 'documented', source: 'github.com/CMSgov/hospital-price-transparency V3.0.0_Tall_CSV_Format_Template.csv and UPDATE_GUIDE.md', checked: '2026-11-16' }),
  // Practice-management and clearinghouse exports (column names as recalled)
  e('tebra_charges', 'Tebra (Kareo)', 'Charges detail report (CSV)', ['Encounter ID', 'Procedure Code', 'Service Date', 'Primary Insurance'], { note: 'Tebra help (Encounters Detail Report, read 2026-11-17) confirms Encounter ID as the first column and lists service date, procedure, modifiers and diagnoses, but publishes no exact header text' }),
  e('advancedmd_charges', 'AdvancedMD', 'Charge detail report (CSV)', ['Visit ID', 'Proc Code', 'Date of Service', 'Primary Carrier']),
  e('athena_claims', 'athenaOne', 'Claim worklist export (CSV)', ['Claim ID', 'Primary Payer', 'Claim Status', 'Outstanding']),
  e('ecw_claims', 'eClinicalWorks', 'Claim status report (Excel)', ['Claim No', 'Insurance Name', 'Claim Status', 'Balance']),
  e('availity_remit', 'Availity', 'Remittance viewer export (CSV)', ['Patient Control Number', 'Payer Claim Control Number', 'Check/EFT Number', 'Paid Amount'], { note: 'a payer tip sheet for the Availity Remittance Viewer (Nov 2020, read 2026-11-17) describes PDF download only; if your account has no CSV, use the 835 file instead' }),
  e('waystar_remit', 'Waystar', 'Remit detail export (CSV)', ['Patient Account', 'Payer ICN', 'Check #', 'Paid Amt']),
  e('office_ally_remit', 'Office Ally', 'ERA detail export (CSV)', ['Claim #', 'Check No', 'Paid', 'Adj Code']),
  e('open_dental_procedures', 'Open Dental', 'User query on the procedure log (CSV; database column names)', ['ProcDate', 'ProcCode', 'ToothNum', 'Surf', 'ProcFee'], { basis: 'documented', source: 'opendental.com/site/apiprocedurelogs.html: procedurelog.ProcDate, ProcFee, ToothNum, Surf, ProcStatus, CodeNum and procedurecode.ProcCode (the full schema pages need a support login)', checked: '2026-11-17', note: 'when the query includes ProcStatus, only completed procedures (C, or 2 in the database) are read; treatment-planned, existing and deleted ones are skipped', rows: completedOnly('ProcStatus') }),
].map((x) => [x.id, x])));

/** Row hook for Open Dental's procedure log: keep completed procedures only (status C, stored as 2), when the status column is there. */
export function completedOnly(column) {
  return (rows) => (rows.some((r) => column in r) ? rows.filter((r) => !(column in r) || /^(2|c|complete|completed)$/i.test(String(r[column] ?? '').trim())) : rows);
}

/** A profile for an agent: a catalogue entry plus the agent's column map. */
export function exportProfile(key, map, extra = {}) {
  const base = EXPORTS[key];
  if (!base) throw new Error(`unknown export "${key}"`);
  return { ...base, map, ...extra };
}

export const EXPORTS_BASIS_NOTE = 'Where a layout says "checked", its column names were compared with the publisher\'s template or documentation on that date (the CMS price-transparency templates, the pfs.data.cms.gov column lists and Open Dental\'s published procedure log fields). The NCCI, MUE and RVU file headers and the other practice-management and clearinghouse layouts were written from knowledge of the export and were not checked; where the vendor\'s public help says something about the export, the layout\'s note says what. None was tested against a live account.';

/**
 * Row hook for grouped reports (QuickBooks style): a row with only its first
 * cell filled names the group for the rows under it; "Total for ..." rows end it.
 * The group name is written to `field` on each detail row.
 */
export function carryGroup(field, { groupColumn = '', isDetail } = {}) {
  return (rows) => {
    const out = []; let group = '';
    for (const r of rows) {
      const label = String(r[groupColumn] ?? '').trim();
      const detail = isDetail ? isDetail(r) : Object.entries(r).some(([k, v]) => k !== groupColumn && k !== field && String(v ?? '').trim() !== '');
      if (label && /^(grand\s+)?total\b/i.test(label)) continue;
      if (label && !detail) { group = label; continue; }
      if (!detail) continue;
      const { [groupColumn]: _drop, ...rest } = r;
      out.push({ ...rest, [field]: String(r[field] ?? '').trim() || label || group });
    }
    return out;
  };
}

/** Row hook: keep the first row for each value of `field` (Shopify repeats an order once per line item). */
export function firstRowPer(field) {
  return (rows) => { const seen = new Set(); return rows.filter((r) => { const k = String(r[field] ?? ''); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
}

/** "First Last" from two columns, for exports that split the name. */
export const fullName = (first, last) => ({ from: [first, last], compute: (_r, get) => [get(first), get(last)].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ') });
