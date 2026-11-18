// Denials as several agents see them: every adjustment on a remittance that is not
// an expected write-down or patient cost-sharing, with the root-cause category its
// reason code (and remark codes) point to. Pure functions; no I/O.
import { reasonInfo, DENIAL_CATEGORIES, RARC } from './codes.js';
import { allAdjustments, allRemarks } from './billing-sources.js';
import { round2, str, payerKey } from './billing.js';

/**
 * Category for one adjustment. Order: payer-specific mapping (config or accepted
 * memory), then the config's reason_codes, then the built-in table, then a remark
 * code that is more specific, else unknown.
 */
export function categorise(adj, { payer = '', remarks = [], overrides = {}, payerMap = [] } = {}) {
  const code = str(adj.reason).toUpperCase().replace(/^0+(?=\d)/, '');
  const pk = payerKey(payer);
  const pm = payerMap.find((m) => str(m.code).toUpperCase() === code && (!m.payer || payerKey(m.payer) === pk) && (!m.group || m.group === adj.group));
  if (pm) return { code, known: true, source: pm.source || 'payer_map', category: pm.category, text: pm.text || (reasonInfo(code, { overrides }).text), mapping_id: pm.id || null };
  const info = reasonInfo(code, { overrides });
  // A generic reason (16, 125, 252...) with a specific remark: the remark says more.
  if (['documentation', 'unknown'].includes(info.category)) {
    for (const r of remarks) { const ri = RARC[str(r).toUpperCase()]; if (ri && ri.category !== 'documentation') return { ...info, category: ri.category, refined_by_remark: str(r).toUpperCase() }; }
  }
  return info;
}

/**
 * Denial lines from remit claims (read835 / groupRemits shape).
 * Returns one row per denying adjustment with category, team and next step.
 * Contractual write-downs (CO-45 and the like) and deductible/coinsurance/copay are skipped.
 */
export function denialLines(claims, { overrides = {}, payerMap = [] } = {}) {
  const rows = [];
  for (const c of claims) {
    const remarks = allRemarks(c);
    const adjs = allAdjustments(c);
    for (const a of adjs) {
      const lineRemarks = a.line ? a.line.remarks || [] : c.remarks || [];
      const info = categorise(a, { payer: c.payer, remarks: [...lineRemarks, ...remarks], overrides, payerMap });
      if (info.category === 'not_denial') continue;
      if (a.group === 'CR') continue;
      const cat = DENIAL_CATEGORIES[info.category] || DENIAL_CATEGORIES.unknown;
      rows.push({
        claim_id: c.claim_id, payer_claim_id: c.payer_claim_id || null, payer: c.payer || null, check_number: c.check_number || null, payment_date: c.payment_date || null, submitted_date: c.submitted_date || null,
        patient_name: c.patient_name || null, member_id: c.member_id || null, rendering_npi: c.rendering_npi || null, claim_status: c.status || null,
        code: a.line ? a.line.code : null, modifiers: a.line ? a.line.modifiers || [] : [], date_of_service: a.line ? a.line.date_from : c.statement_from || null,
        billed: a.line ? a.line.charge : c.charge, paid: a.line ? a.line.paid : c.paid, line_denied: a.line ? a.line.paid === 0 : c.paid === 0,
        group: a.group, reason: info.code, amount: round2(a.amount || 0), remarks: [...new Set([...lineRemarks, ...(a.line ? [] : remarks)])],
        category: info.category, known: info.known, text: info.text, team: cat.team, next_step: cat.next, refined_by_remark: info.refined_by_remark || null, mapping_id: info.mapping_id || null,
      });
    }
  }
  return rows;
}
