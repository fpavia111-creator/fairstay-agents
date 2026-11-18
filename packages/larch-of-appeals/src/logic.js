// Larch logic: denial appeal deadlines by payer and level. No I/O.
import { str, num, isoDate, addDays, daysBetween, payerType, sortByStatus, countBy, total } from 'evergreen-core';

const ORDER = { appeal_window_closed: 0, appeal_due_soon: 1, decision_overdue: 2, next_level_open: 3, appeal_open: 4 };

/**
 * Default appeal levels by payer type: days to file (from the denial or the last decision) and days the payer has to decide.
 * Medicare fee-for-service levels follow the public CMS appeal process (redetermination, reconsideration, ALJ, Council).
 * Medicaid and managed care vary by state and contract: these are placeholders to replace in the rules file.
 */
export const DEFAULT_LEVELS = Object.freeze({
  medicare_a: [{ name: 'Redetermination', file_days: 120, decide_days: 60 }, { name: 'Reconsideration (QIC)', file_days: 180, decide_days: 60 }, { name: 'ALJ hearing', file_days: 60, decide_days: 90 }, { name: 'Appeals Council review', file_days: 60, decide_days: 90 }],
  medicare_b: [{ name: 'Redetermination', file_days: 120, decide_days: 60 }, { name: 'Reconsideration (QIC)', file_days: 180, decide_days: 60 }, { name: 'ALJ hearing', file_days: 60, decide_days: 90 }, { name: 'Appeals Council review', file_days: 60, decide_days: 90 }],
  managed_care: [{ name: 'Plan reconsideration', file_days: 60, decide_days: 60 }, { name: 'Independent review', file_days: 60, decide_days: 60 }],
  medicaid: [{ name: 'Reconsideration', file_days: 90, decide_days: 60 }, { name: 'Fair hearing', file_days: 90, decide_days: 90 }],
  insurance: [{ name: 'First level appeal', file_days: 180, decide_days: 60 }, { name: 'Second level appeal', file_days: 60, decide_days: 60 }],
});

/**
 * denials: [{ resident_id, resident_name, payer, payer_type, claim_id, from, to, amount, denied_on, reason, level (0 = no appeal yet), filed_on, decided_on, decision }]
 * level is the appeal level last filed (0 or blank: none). decision: upheld | overturned | partial | blank.
 */
export function checkAppeals(denials, { asOf, warnDays = 14, levels = {} } = {}) {
  const L = { ...DEFAULT_LEVELS, ...levels };
  const items = []; let open = 0;
  denials.forEach((r, i) => {
    const type = payerType(r.payer, r.payer_type); const lv = num(r.level) || 0; const ladder = L[type] || null;
    const decision = str(r.decision).toLowerCase(); const filed = isoDate(r.filed_on); const decided = isoDate(r.decided_on); const denied = isoDate(r.denied_on);
    const base = { resident_id: str(r.resident_id) || str(r.resident_name), resident_name: str(r.resident_name) || null, payer: str(r.payer), payer_type: type, claim_id: str(r.claim_id) || null, from: isoDate(r.from), to: isoDate(r.to), amount: num(r.amount) || 0, reason: str(r.reason) || null, level: lv, line: i + 1 };
    if (/overturn|paid|won/.test(decision)) return;
    open++;
    if (!ladder) { items.push({ status: 'appeal_open', ...base, message: `No appeal levels are set for payer type ${type}.`, fix: 'Add this payer type\'s appeal levels to the rules file from the contract or state rules.' }); return; }
    // Filed and waiting on a decision.
    if (lv > 0 && filed && !decision) {
      const step = ladder[lv - 1]; const due = step ? addDays(filed, step.decide_days) : null;
      if (due && due < asOf) items.push({ status: 'decision_overdue', ...base, level_name: step.name, decision_due: due, days_late: daysBetween(due, asOf), message: `${step.name} filed ${filed}; a decision was due ${due} (${daysBetween(due, asOf)} days ago).`, fix: 'Call the payer for the status; some levels let you escalate when the decision is late.' });
      return;
    }
    // Next level to file: level 1 from the denial, or the next level after an upheld decision.
    const next = ladder[lv]; const startOn = lv === 0 ? denied : decided;
    if (!next) { items.push({ status: 'appeal_open', ...base, message: `All ${ladder.length} appeal levels for ${type} are used.`, fix: 'Decide whether to write it off or take it outside the appeal process.' }); return; }
    if (!startOn) return;
    const deadline = addDays(startOn, next.file_days); const left = daysBetween(asOf, deadline);
    const ext = { next_level: lv + 1, level_name: next.name, deadline, days_left: left };
    if (left < 0) items.push({ status: 'appeal_window_closed', ...base, ...ext, message: `The ${next.name} deadline was ${deadline} (${-left} days ago).`, fix: 'Check for a good-cause extension; otherwise record the loss and why it was missed.' });
    else if (left <= warnDays) items.push({ status: 'appeal_due_soon', ...base, ...ext, message: `File the ${next.name} by ${deadline} (${left} days).`, fix: 'Draft the appeal letter now (larch_draft_appeal_letter) and gather the records it lists.' });
    else items.push({ status: lv ? 'next_level_open' : 'appeal_open', ...base, ...ext, message: `${lv ? `Level ${lv} was upheld; the` : 'The'} ${next.name} can be filed until ${deadline} (${left} days).`, fix: 'Decide at the denial meeting whether to appeal; the amount and the reason decide it.' });
  });
  sortByStatus(items, ORDER);
  return { as_of: asOf, open_denials: open, open_amount: total(items, 'amount'), due_soon_amount: total(items.filter((i) => i.status === 'appeal_due_soon'), 'amount'), lost_amount: total(items.filter((i) => i.status === 'appeal_window_closed'), 'amount'), by_status: countBy(items, 'status'), items };
}
