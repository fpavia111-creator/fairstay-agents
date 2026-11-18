// Column names nursing-home exports use. Aliases cover common PointClickCare, MatrixCare and
// American HealthTech style headers, written from public help pages and general knowledge,
// NOT checked against real exports. A setup confirms them with `<agent> sources`.
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const RESIDENT_ID = t(['Resident ID', 'Resident #', 'Resident Number', 'Res ID', 'Res #', 'MRN', 'Medical Record Number', 'Client ID', 'Patient ID', 'Resident No'], { phi: 'mrn', translate: false });
export const RESIDENT_NAME = t(['Resident', 'Resident Name', 'Name', 'Patient', 'Patient Name', 'Client Name', 'Resident Full Name'], { phi: 'name' });
export const FACILITY = t(['Facility', 'Facility Name', 'Building', 'Location', 'Fac', 'Center']);
export const PAYER = t(['Payer', 'Payer Name', 'Primary Payer', 'Pay Source', 'Payer Source', 'Payor', 'Payor Name', 'Insurance', 'Financial Class']);
export const PAYER_TYPE = t(['Payer Type', 'Payor Type', 'Payer Class', 'Payer Category', 'Pay Type']);
export const LEVEL = t(['Level', 'Level of Care', 'Care Level', 'Rate Type', 'Rate Level', 'Room Type', 'Accommodation', 'RUG', 'HIPPS', 'PDPM Group']);
export const DATE_FROM = (more = []) => t(['From', 'Start', 'Start Date', 'Effective Date', 'Begin Date', 'From Date', 'Admit Date', ...more], { type: 'date' });
export const DATE_TO = (more = []) => t(['To', 'End', 'End Date', 'Thru', 'Through', 'Thru Date', 'Through Date', 'To Date', 'Discharge Date', ...more], { type: 'date' });

/** Census: one row per stretch of a stay with one payer, level and bed status. */
export const CENSUS_FIELDS = Object.freeze({
  resident_id: RESIDENT_ID,
  resident_name: RESIDENT_NAME,
  facility: FACILITY,
  from: { ...DATE_FROM(['Census Date', 'Effective', 'Payer Effective Date']), required: true },
  to: DATE_TO(['Payer End Date', 'Ineffective Date']),
  payer: { ...PAYER, required: true },
  payer_type: PAYER_TYPE,
  level: LEVEL,
  bed_status: t(['Bed Status', 'Status', 'Census Status', 'Action', 'Census Action', 'Leave Type']),
  room: t(['Room', 'Room Bed', 'Bed', 'Room/Bed', 'Unit']),
});

/** Money in or out with a date (ledger, receipts, payments). */
export const AMOUNT = t(['Amount', 'Amt', 'Total', 'Balance', 'Net Amount', 'Payment Amount', 'Paid', 'Paid Amount'], { type: 'money' });
