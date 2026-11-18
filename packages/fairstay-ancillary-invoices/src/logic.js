// Fairstay Ancillary Invoices logic: ancillary invoice review against the census and contract rates. No I/O.
import { str, num, isoDate, payerKey, idKey, censusDays, sortByStatus, countBy, total, round2 } from 'fairstay-core';

const ORDER = { not_in_building: 0, duplicate_line: 1, bill_payer_instead: 2, outside_consolidated_billing: 3, above_contract: 4 };
const DIRECT = new Set(['pharmacy', 'lab', 'radiology', 'supply']);

/**
 * lines: [{ vendor, vendor_type, invoice_no, resident_id, resident_name, date, code, description, qty, amount }]
 * rates: [{ vendor, code, rate }]   per unit
 * opts: { snfPays=['medicare_a','managed_care'], cbExcluded=[codes], tolerance=0.01 }
 */
export function reviewAncillaries(lines, census, rates = [], { snfPays = ['medicare_a', 'managed_care'], cbExcluded = [], tolerance = 0.01 } = {}) {
  const dates = lines.map((l) => isoDate(l.date)).filter(Boolean).sort();
  const days = dates.length ? censusDays(census, dates[0], dates.at(-1)) : [];
  const idx = new Map(); for (const d of days) idx.set(`${idKey(d.resident_id)}|${d.date}`, d);
  const R = new Map(rates.map((r) => [`${payerKey(r.vendor)}|${idKey(r.code)}`, num(r.rate)]));
  const pays = new Set(snfPays); const excluded = new Set(cbExcluded.map(idKey));
  const seen = new Map(); const items = [];
  lines.forEach((l, i) => {
    const date = isoDate(l.date); const amount = num(l.amount) || 0; const type = str(l.vendor_type).toLowerCase(); const qty = num(l.qty) || 1;
    const base = { vendor: str(l.vendor), vendor_type: type || null, invoice_no: str(l.invoice_no) || null, resident_id: str(l.resident_id) || str(l.resident_name), resident_name: str(l.resident_name) || null, date, code: str(l.code) || null, description: str(l.description) || null, qty, billed: amount, line: i + 1 };
    const add = (status, amt, message, fix, extra = {}) => items.push({ status, ...base, amount: round2(amt), message, fix, ...extra });
    const dk = `${payerKey(l.vendor)}|${idKey(base.resident_id)}|${date}|${idKey(l.code)}`;
    if (seen.has(dk)) { add('duplicate_line', amount, `Same resident, date and item as line ${seen.get(dk)}.`, 'Ask for a credit for the duplicate.', { duplicate_of_line: seen.get(dk) }); return; }
    seen.set(dk, i + 1);
    const c = idx.get(`${idKey(base.resident_id)}|${date}`);
    if (!c || c.bed_status === 'discharged') { add('not_in_building', amount, `Billed for ${date}, when the resident was not on the census.`, 'Ask for a credit; the resident was discharged, not yet admitted or not here.'); return; }
    if (c.bed_status === 'hospital') { add('not_in_building', amount, `Billed for ${date}, while the resident was in the hospital.`, 'Ask for a credit; the hospital supplies care during the stay.'); return; }
    const snf = pays.has(c.payer_type);
    if (!snf && DIRECT.has(type)) { add('bill_payer_instead', amount, `The resident was on ${c.payer} (${c.payer_type}) on ${date}; the ${type} provider should bill that payer, not the facility.`, 'Ask the vendor to rebill Part D, Part B, Medicaid or the resident, and credit the facility.', { payer: c.payer, payer_type: c.payer_type }); return; }
    if (c.payer_type === 'medicare_a' && l.code && excluded.has(idKey(l.code))) { add('outside_consolidated_billing', amount, `${base.code} is on your list of items outside Part A consolidated billing; the provider bills Medicare directly.`, 'Ask the vendor to bill Medicare Part B for it and credit the facility.', { payer: c.payer }); return; }
    const rate = R.get(`${payerKey(l.vendor)}|${idKey(l.code)}`);
    if (rate !== undefined && rate !== null && amount > rate * qty + tolerance) add('above_contract', amount - rate * qty, `Billed ${amount} for ${qty} unit(s); the contract rate is ${rate} each.`, 'Ask for a credit for the difference.', { contract_rate: rate });
  });
  sortByStatus(items, ORDER);
  return { lines: lines.length, billed: total(lines, (l) => num(l.amount) || 0), credits_due: total(items, 'amount'), vendors: new Set(lines.map((l) => payerKey(l.vendor))).size, by_status: countBy(items, 'status'), items };
}
