// ASC X12 envelope reader. It splits an interchange into segments, reads the
// envelope (ISA/GS/ST and their trailers), checks the control numbers and counts,
// and hands each transaction's segments to the healthcare readers in hc-x12.js.

export const clean = (s) => String(s ?? '').trim();
/** N2 numbers (two implied decimals): "123456" is 1234.56. Plain decimals pass through. */
export const n2 = (v) => { const s = clean(v); if (!s) return null; if (/^-?\d+$/.test(s)) return Number(s) / 100; const n = Number(s); return Number.isFinite(n) ? n : null; };
export const plain = (v) => { const s = clean(v); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
export const x12Date = (d) => { const s = clean(d); if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; if (/^\d{6}$/.test(s)) return `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`; return null; };
const x12Time = (t) => { const s = clean(t); return /^\d{4}/.test(s) ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : null; };
export const x12DateTime = (d, t) => { const day = x12Date(d); if (!day) return null; const tm = x12Time(t); return tm ? `${day}T${tm}:00` : day; };

/** Detect the delimiters from the ISA segment. */
export function x12Delimiters(text) {
  const s = String(text).replace(/^﻿/, '');
  const at = s.indexOf('ISA');
  if (at < 0) throw new Error('not an X12 file: no ISA segment');
  const isa = s.slice(at);
  const element = isa[3];
  if (!element || /[A-Za-z0-9\s]/.test(element)) throw new Error('not an X12 file: ISA has no element separator');
  // ISA has 16 elements; the 16th (component separator) is one character, then the segment terminator.
  let pos = 0, count = 0;
  while (count < 16 && pos < isa.length) { if (isa[pos] === element) count++; pos++; }
  if (count < 16) throw new Error('ISA segment is cut short');
  const component = isa[pos];
  let segment = isa[pos + 1];
  if (segment === '\r' && isa[pos + 2] === '\n') segment = '\r\n';
  if (!segment) throw new Error('ISA segment has no terminator');
  return { element, component, segment, start: at };
}

/** Split an X12 file into segments (arrays of elements). Line breaks after terminators are ignored. */
export function x12Segments(text) {
  const d = x12Delimiters(text);
  const body = String(text).replace(/^﻿/, '').slice(d.start);
  const term = d.segment.trim() === '' ? /\r?\n/ : new RegExp(`${d.segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`);
  const segs = body.split(term).map((s) => s.replace(/^[\r\n]+/, '')).filter((s) => s.trim() !== '');
  return { delimiters: d, segments: segs.map((s, i) => ({ n: i + 1, id: s.split(d.element)[0].trim(), el: s.split(d.element), raw: s })) };
}

/**
 * Parse an X12 interchange into envelopes and transactions and check its
 * structure. Returns { interchanges, transactions, problems }.
 */
export function parseX12(text, { maxTransactions = 50000 } = {}) {
  const { delimiters, segments } = x12Segments(text);
  const problems = [];
  const interchanges = []; const transactions = [];
  let isa = null, gs = null, st = null;
  const p = (seg, code, message) => problems.push({ segment: seg ? seg.n : null, code, message });
  for (const seg of segments) {
    const e = seg.el;
    switch (seg.id) {
      case 'ISA':
        if (isa) p(seg, 'isa_not_closed', `ISA ${clean(isa.el[13])} has no IEA before the next ISA`);
        isa = { ...seg, control: clean(e[13]), sender: clean(e[6]), receiver: clean(e[8]), date: x12Date(e[9]), groups: 0 };
        interchanges.push({ control: isa.control, sender: isa.sender, receiver: isa.receiver, date: isa.date, version: clean(e[12]), usage: clean(e[15]) === 'T' ? 'test' : clean(e[15]) === 'P' ? 'production' : clean(e[15]) });
        break;
      case 'GS':
        if (!isa) p(seg, 'gs_outside_isa', 'GS before any ISA');
        if (gs) p(seg, 'gs_not_closed', `GS ${clean(gs.el[6])} has no GE`);
        gs = { ...seg, control: clean(e[6]), functional: clean(e[1]), version: clean(e[8]), sets: 0 };
        if (isa) isa.groups++;
        break;
      case 'ST':
        if (!gs) p(seg, 'st_outside_gs', 'ST before any GS');
        if (st) p(seg, 'st_not_closed', `ST ${clean(st.control)} has no SE`);
        st = { set: clean(e[1]), control: clean(e[2]), start: seg.n, segments: [seg] };
        if (gs) gs.sets++;
        break;
      case 'SE': {
        if (!st) { p(seg, 'se_outside_st', 'SE without ST'); break; }
        st.segments.push(seg);
        const declared = Number(clean(e[1])), actual = st.segments.length;
        if (declared !== actual) p(seg, 'se_count', `transaction ${st.set} ${st.control}: SE says ${declared} segment(s), found ${actual}`);
        if (clean(e[2]) !== st.control) p(seg, 'se_control', `transaction ${st.set}: SE control ${clean(e[2])} does not match ST control ${st.control}`);
        if (transactions.length < maxTransactions) transactions.push({ set: st.set, control: st.control, group: gs ? gs.control : null, interchange: isa ? isa.control : null, segments: st.segments });
        st = null; break;
      }
      case 'GE':
        if (!gs) { p(seg, 'ge_outside_gs', 'GE without GS'); break; }
        if (Number(clean(e[1])) !== gs.sets) p(seg, 'ge_count', `group ${gs.control}: GE says ${clean(e[1])} transaction(s), found ${gs.sets}`);
        if (clean(e[2]) !== gs.control) p(seg, 'ge_control', `GE control ${clean(e[2])} does not match GS control ${gs.control}`);
        gs = null; break;
      case 'IEA':
        if (!isa) { p(seg, 'iea_outside_isa', 'IEA without ISA'); break; }
        if (Number(clean(e[1])) !== isa.groups) p(seg, 'iea_count', `interchange ${isa.control}: IEA says ${clean(e[1])} group(s), found ${isa.groups}`);
        if (clean(e[2]) !== isa.control) p(seg, 'iea_control', `IEA control ${clean(e[2])} does not match ISA control ${isa.control}`);
        isa = null; break;
      default:
        if (st) st.segments.push(seg); else p(seg, 'segment_outside_st', `${seg.id} outside a transaction`);
    }
  }
  if (st) p(null, 'st_not_closed', `transaction ${st.set} ${st.control} has no SE`);
  if (gs) p(null, 'gs_not_closed', `group ${gs.control} has no GE`);
  if (isa) p(null, 'isa_not_closed', `interchange ${isa.control} has no IEA`);
  return { delimiters: { element: delimiters.element, component: delimiters.component, segment: delimiters.segment === '\r\n' ? '\\r\\n' : delimiters.segment }, interchanges, transactions, problems };
}

