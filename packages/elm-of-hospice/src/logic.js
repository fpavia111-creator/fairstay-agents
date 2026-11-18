// Elm logic: hospice room and board for nursing-home residents. No I/O.
import { str, num, isoDate, daysBetween, payerKey, payerType, censusDays, dateRange, dayRuns, monthBounds, sortByStatus, countBy, total, round2, idKey } from 'evergreen-core';

const ORDER = { medicaid_billed_directly: 0, not_invoiced: 1, no_contract: 2, rate_below_contract: 3, invoiced_not_in_census: 4, unpaid: 5 };

/** A census day is a hospice day when it names a hospice, or its payer is a hospice. */
const hospiceOf = (row) => str(row.hospice) || (payerType(row.payer, row.payer_type) === 'hospice' ? str(row.payer) : '');

/**
 * census: rows with optional `hospice` column. invoices: room and board invoices to hospices (service dates inclusive).
 * contracts: [{ hospice, rate, from?, to?, pay_days? }]. claims: optional Medicaid claim lines [{ resident_id, payer, from, to }].
 */
export function checkHospice(census, invoices, contracts, claims = [], { month, asOf, payDays = 30, tolerance = 0.01 } = {}) {
  const { start, end } = monthBounds(month);
  const days = []; census.forEach((r) => { const h = hospiceOf(r); if (!h) return; for (const d of censusDays([r], start, end)) days.push({ ...d, hospice: h }); });
  const hDays = new Map(days.map((d) => [`${idKey(d.resident_id)}|${d.date}`, d]));
  const names = new Map(); for (const r of [...census, ...invoices]) if (r.resident_name) names.set(idKey(r.resident_id || r.resident_name), str(r.resident_name));
  // Contracts and hospice days grouped by hospice once (looking through every row for every day took 25 s at 10,000 rows).
  const hk = new Map(); const hKey = (h) => { const s = String(h ?? ''); if (!hk.has(s)) hk.set(s, payerKey(h)); return hk.get(s); };
  const contractsBy = new Map(); for (const c of contracts) { const k = hKey(c.hospice); if (!contractsBy.has(k)) contractsBy.set(k, []); contractsBy.get(k).push(c); }
  const contractFor = (h, date) => (contractsBy.get(hKey(h)) || []).find((c) => (!c.from || isoDate(c.from) <= date) && (!c.to || isoDate(c.to) >= date));
  const invoiced = new Set(); const finds = []; const items = [];
  invoices.forEach((inv, i) => {
    const from = isoDate(inv.from); if (!from) return; const to = isoDate(inv.to) || from; const rid = idKey(inv.resident_id || inv.resident_name);
    const span = dateRange(from, to); const n = num(inv.days) ?? span.length;
    for (const date of span) { invoiced.add(`${rid}|${date}`); if (date >= start && date <= end && !hDays.has(`${rid}|${date}`)) finds.push({ resident_id: str(inv.resident_id) || str(inv.resident_name), date, status: 'invoiced_not_in_census', hospice: str(inv.hospice), amount: n ? round2((num(inv.amount) || 0) / n) : 0 }); }
    const c = contractFor(inv.hospice, from); const amt = num(inv.amount); const base = { resident_id: str(inv.resident_id) || str(inv.resident_name), resident_name: str(inv.resident_name) || null, hospice: str(inv.hospice), invoice_id: str(inv.invoice_id) || null, from, to, days: n, line: i + 1 };
    if (c && amt !== null && n) { const got = round2(amt / n); const exp = num(c.rate); if (exp !== null && got + tolerance < exp) items.push({ status: 'rate_below_contract', ...base, amount: round2((exp - got) * n), message: `Invoiced ${got} a day; the ${base.hospice} contract rate is ${exp}.`, fix: 'Rebill the hospice at the contract rate.' }); }
    const paid = num(inv.paid_amount) || 0; const invDate = isoDate(inv.invoice_date); const limit = num(c?.pay_days) ?? payDays;
    if (amt && paid + tolerance < amt && invDate && asOf && daysBetween(invDate, asOf) > limit) items.push({ status: 'unpaid', ...base, amount: round2(amt - paid), days_outstanding: daysBetween(invDate, asOf), message: `${round2(amt - paid)} unpaid ${daysBetween(invDate, asOf)} days after the invoice (contract terms ${limit} days).`, fix: 'Send the hospice a statement and call its billing office; the hospice is paid by Medicare or Medicaid for these days.' });
  });
  for (const d of days) if (!invoiced.has(`${idKey(d.resident_id)}|${d.date}`) && d.bed_status === 'in_house') { const c = contractFor(d.hospice, d.date); finds.push({ ...d, status: 'not_invoiced', amount: num(c?.rate) || 0 }); }
  for (const cl of claims) {
    if (!/medicaid|mcd/i.test(str(cl.payer)) && payerType(cl.payer, cl.payer_type) !== 'medicaid') continue;
    for (const date of dateRange(isoDate(cl.from), isoDate(cl.to) || isoDate(cl.from))) { const h = hDays.get(`${idKey(cl.resident_id || cl.resident_name)}|${date}`); if (h) finds.push({ ...h, status: 'medicaid_billed_directly', amount: num(contractFor(h.hospice, date)?.rate) || 0 }); }
  }
  const seenNoContract = new Set(); const daysBy = new Map(); for (const x of days) { const k = hKey(x.hospice); if (!daysBy.has(k)) daysBy.set(k, []); daysBy.get(k).push(x); }
  for (const d of days) { const k = hKey(d.hospice); if (!seenNoContract.has(k) && !contractFor(d.hospice, d.date)) { seenNoContract.add(k); const ds = daysBy.get(k).map((x) => x.date).sort(); items.push({ status: 'no_contract', resident_id: null, resident_name: null, hospice: d.hospice, from: ds[0], to: ds.at(-1), days: ds.length, amount: 0, message: `${d.hospice} has hospice residents this month and no room and board contract on file.`, fix: 'Get a signed hospice agreement before invoicing; Medicare requires one for hospice care in a nursing home.' }); } }
  for (const r of dayRuns(finds, (f) => `${f.resident_id}|${f.status}|${f.hospice}`)) {
    const f = r.first; const span = r.from === r.to ? r.from : `${r.from} to ${r.to}`; const amount = round2(r.items.reduce((s, x) => s + (x.amount || 0), 0));
    const T = {
      not_invoiced: [`${r.days} hospice day(s) with ${f.hospice} (${span}) are not on a room and board invoice.`, 'Invoice the hospice for the days.'],
      invoiced_not_in_census: [`${r.days} day(s) invoiced to ${f.hospice} (${span}) are not hospice days on the census.`, 'Credit the hospice for the days, or fix the census if the resident was on hospice.'],
      medicaid_billed_directly: [`${r.days} hospice day(s) (${span}) were also billed to Medicaid directly.`, 'Void the Medicaid days: Medicaid pays the hospice, and the hospice pays room and board.'],
    }[f.status];
    items.push({ status: f.status, resident_id: f.resident_id, resident_name: names.get(idKey(f.resident_id)) || null, hospice: f.hospice, from: r.from, to: r.to, days: r.days, amount, message: T[0], fix: T[1] });
  }
  sortByStatus(items, ORDER);
  return { month, hospice_residents: new Set(days.map((d) => d.resident_id)).size, hospice_days: days.length, invoiced_total: total(invoices, (x) => num(x.amount) || 0), not_invoiced: total(items.filter((i) => i.status === 'not_invoiced'), 'amount'), unpaid: total(items.filter((i) => i.status === 'unpaid'), 'amount'), by_status: countBy(items, 'status'), items };
}
