// Small, pure helpers the Remedy agents share: numbers, dates, identifier checks
// (NPI check digit, ICD-10-CM, CPT/HCPCS/CDT shape) and grouping. No I/O.

export const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/[$€£¥₩\s,]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s); return Number.isFinite(n) ? n : null;
};
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const sum = (xs, f = (x) => x) => round2(xs.reduce((s, x) => s + (Number(f(x)) || 0), 0));
export const pct = (a, b) => (b ? round2((a / b) * 100) : 0);
export function groupBy(xs, key) { const m = new Map(); for (const x of xs) { const k = typeof key === 'function' ? key(x) : x[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; }

/** 'YYYY-MM-DD' from an ISO-ish date or Date, else null. */
export function isoDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) { const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`); return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}` ? null : `${m[1]}-${m[2]}-${m[3]}`; }
  if (/^\d{8}$/.test(s)) return isoDate(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`);
  return null;
}
const ms = (d) => new Date(`${d}T00:00:00Z`).getTime();
export const daysBetween = (a, b) => { const x = isoDate(a), y = isoDate(b); return x && y ? Math.round((ms(y) - ms(x)) / 86400000) : null; };
export const addDays = (d, n) => { const x = isoDate(d); return x ? new Date(ms(x) + n * 86400000).toISOString().slice(0, 10) : null; };
export const addMonths = (d, n) => { const x = isoDate(d); if (!x) return null; const dt = new Date(ms(x)); const day = dt.getUTCDate(); dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth() + n); const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate(); dt.setUTCDate(Math.min(day, last)); return dt.toISOString().slice(0, 10); };
export const today = () => new Date().toISOString().slice(0, 10);
/** Whole years between a birth date and a date. */
export function ageOn(dob, date) {
  const a = isoDate(dob), b = isoDate(date); if (!a || !b) return null;
  let y = Number(b.slice(0, 4)) - Number(a.slice(0, 4));
  if (b.slice(5) < a.slice(5)) y--;
  return y;
}
/** Aging bucket label for a number of days. */
export const bucketOf = (days, edges = [30, 60, 90, 120]) => { if (days === null || days === undefined) return 'unknown'; let lo = 0; for (const e of edges) { if (days <= e) return `${lo}-${e}`; lo = e + 1; } return `${edges.at(-1)}+`; };

// ----------------------------------------------------------- identifiers ----

/** NPI check digit (Luhn over "80840" + the first nine digits). */
export function npiValid(v) {
  const s = str(v);
  if (!/^\d{10}$/.test(s)) return false;
  const digits = ('80840' + s.slice(0, 9)).split('').map(Number);
  let total = 0;
  for (let i = digits.length - 1, dbl = true; i >= 0; i--, dbl = !dbl) { let d = digits[i]; if (dbl) { d *= 2; if (d > 9) d -= 9; } total += d; }
  return (10 - (total % 10)) % 10 === Number(s[9]);
}
/** Why an NPI is not usable, or null. */
export const npiProblem = (v) => { const s = str(v); if (!s) return 'missing'; if (!/^\d{10}$/.test(s)) return 'not 10 digits'; if (!/^[12]/.test(s)) return 'does not start with 1 or 2'; return npiValid(s) ? null : 'check digit is wrong'; };

/** ICD-10-CM shape (U07.1 and U09.9 included): letter, digit, letter-or-digit, optional dot and up to four more. Not a code-set lookup. */
export const icd10Valid = (v) => /^[A-Z][0-9][0-9A-Z](\.?[0-9A-Z]{1,4})?$/.test(str(v).toUpperCase());
export const icd10Norm = (v) => str(v).toUpperCase().replace(/\./g, '');
/** Procedure code family by shape: cpt (5 digits), cpt_cat2 (4 digits + F), cpt_cat3 (4 digits + T), pla (4 digits + U), hcpcs (letter + 4 digits), cdt (D + 4 digits), revenue (4 digits) or null. */
export function codeFamily(v) {
  const s = str(v).toUpperCase();
  if (/^D\d{4}$/.test(s)) return 'cdt';
  if (/^\d{5}$/.test(s)) return 'cpt';
  if (/^\d{4}F$/.test(s)) return 'cpt_cat2';
  if (/^\d{4}T$/.test(s)) return 'cpt_cat3';
  if (/^\d{4}U$/.test(s)) return 'pla';
  if (/^[A-CEGHJ-MP-V]\d{4}$/.test(s)) return 'hcpcs';
  if (/^\d{4}$/.test(s)) return 'revenue';
  return null;
}
export const modifierValid = (m) => /^[0-9A-Z]{2}$/.test(str(m).toUpperCase());
/** Split "25,59" / "25 59" / ["25","59"] into modifiers. */
export const modifierList = (v) => (Array.isArray(v) ? v : str(v).split(/[\s,;|:/]+/)).map((m) => str(m).toUpperCase()).filter(Boolean);
export const isEm = (code) => /^992\d\d$/.test(str(code));
export const isAnesthesia = (code) => /^0[0-1]\d{3}$/.test(str(code));
/** Dental tooth designation: 1-32, A-T, or supernumerary 51-82 / AS-TS. */
export const toothValid = (t) => { const s = str(t).toUpperCase(); if (!s) return false; if (/^\d+$/.test(s)) { const n = Number(s); return (n >= 1 && n <= 32) || (n >= 51 && n <= 82); } return /^[A-T]S?$/.test(s); };
export const QUADRANTS = Object.freeze({ UR: '10', UL: '20', LL: '30', LR: '40', 10: '10', 20: '20', 30: '30', 40: '40' });
export const SURFACES = new Set(['M', 'O', 'D', 'I', 'L', 'B', 'F']);

/** Payer key for matching names across files ("BCBS of Example", "bcbs-of-example" → same key). */
const PAYER_KEYS = new Map();
export const payerKey = (v) => {
  const s = str(v); let k = PAYER_KEYS.get(s); if (k !== undefined) return k;
  k = s.toLowerCase().replace(/&/g, ' and ').replace(/\b(inc|llc|co|corp|company|the)\b\.?/g, '').replace(/[^a-z0-9]+/g, '');
  if (PAYER_KEYS.size > 50000) PAYER_KEYS.clear(); PAYER_KEYS.set(s, k); return k;
};
