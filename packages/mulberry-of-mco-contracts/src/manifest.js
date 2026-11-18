import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, EVERGREEN_LIMITS, today, RESIDENT_NAME, PAYER, LEVEL, AMOUNT } from 'evergreen-core';
import { reviewMco } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const CONTRACT_FIELDS = Object.freeze({
  payer: { ...PAYER, required: true }, plan: { aliases: ['Plan', 'Product', 'Plan Name', 'Line of Business'] }, level: LEVEL,
  rate: { aliases: ['Rate', 'Per Diem', 'Daily Rate', 'Contract Rate'], type: 'money', required: true },
  start: { aliases: ['Start', 'Effective', 'Effective Date', 'Start Date'], type: 'date' }, end: { aliases: ['End', 'Term End', 'End Date', 'Expires', 'Expiration'], type: 'date' },
  auto_renew: { aliases: ['Auto Renew', 'Evergreen', 'Renews', 'Auto-Renew'] }, notice_days: { aliases: ['Notice Days', 'Notice', 'Termination Notice Days'], type: 'number' },
  last_rate_change: { aliases: ['Last Rate Change', 'Rate Changed', 'Last Increase'], type: 'date' },
});
export const PAYMENT_FIELDS = Object.freeze({
  payer: { ...PAYER, required: true }, level: LEVEL, resident_name: RESIDENT_NAME, claim_id: { aliases: ['Claim', 'Claim ID', 'Claim Number', 'ICN'], phi: 'account' },
  from: { aliases: ['From', 'Service From', 'From Date', 'Start'], type: 'date', required: true }, days: { aliases: ['Days', 'Units', 'Covered Days'], type: 'number', required: true },
  paid: { ...AMOUNT, aliases: ['Paid', 'Paid Amount', 'Payment', 'Amount'], required: true },
});
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: {
  benchmarks: { type: 'array', description: 'Your market or cost benchmark per level: [{level, rate}] (a row with no level covers the rest)', items: { type: 'object', additionalProperties: false, required: ['rate'], properties: { level: { type: 'string', description: 'Level of care' }, rate: { type: 'number', description: 'Benchmark per-diem' } } } },
  warn_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Flag notice dates and ends within this many days (default 30)' },
  stale_years: { type: 'number', minimum: 0.5, maximum: 10, description: 'Flag rates unchanged for longer than this (default 2 years)' },
} };
export const MEMORY_KINDS = Object.freeze({ plan_note: { description: 'A note on a plan, e.g. {"note": "Lone Star Health pays late; escalate at 45 days"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  contracts: fileArg('Managed care contracts under --root: payer, plan, level, per-diem rate, start, end, auto renew, notice days, last rate change'),
  payments: fileArg('Optional remittance lines: payer, level, resident, claim, from date, days, paid'),
  rules: fileArg('Optional rules JSON: benchmarks, warn_days, stale_years'),
  as_of: DATE_ARG('Review date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'mulberry_rules') : {}; return reviewMco(ctx.records(a.contracts, 'contracts'), a.payments ? ctx.records(a.payments, 'payments') : [], { asOf: a.as_of || today(), benchmarks: r.benchmarks || [], warnDays: r.warn_days, staleYears: r.stale_years }); };
const summary = (o) => `${o.contracts} contract rate(s) with ${o.payers} payer(s); ${o.payment_lines} payment line(s). Underpaid ${o.underpaid}; below benchmark ${o.below_benchmark} on paid days. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing to act on'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'mulberry', title: 'Mulberry of MCO Contracts',
  description: 'Managed care contract review for nursing homes: claims paid below the contract rate, per-diems below your benchmark, contracts ended or in their notice window, rates unchanged for years, plans paying with no contract on file, and a payer matrix for the admissions team. Resident names and claim numbers are masked before results reach the model.',
  args, required: ['contracts'],
  sources: { contracts: { label: 'Managed care contracts', args: ['contracts'], fields: CONTRACT_FIELDS }, payments: { label: 'Remittance lines', args: ['payments'], fields: PAYMENT_FIELDS } },
  configSchemas: { mulberry_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Review managed care contracts', description: 'Review contract rates, dates and payments, and build the payer matrix.' },
  reads: [{ name: 'mulberry_payer_matrix', title: 'Payer matrix', description: 'The payer matrix for admissions: each plan, level, rate, benchmark and whether the contract is in force.', properties: { contracts: args.contracts, rules: args.rules, as_of: args.as_of }, required: ['contracts'], run: (a, ctx) => { const o = run(a, ctx); return { summary: `${o.matrix.length} plan and level row(s).`, matrix: o.matrix }; } }],
  report: {
    title: { en: 'Managed care contract review', es: 'Revisión de contratos de atención administrada', de: 'Prüfung der Managed-Care-Verträge', fr: 'Revue des contrats de soins gérés', pt: 'Revisão de contratos de atenção gerenciada', it: 'Revisione dei contratti di managed care', ja: 'マネージドケア契約レビュー', zh: '管理式医疗合同审查', ko: '관리의료 계약 검토' },
    base: 'mulberry-mco-contracts',
    rows: (o) => o.items.map((i) => ({ status: i.status, payer: i.payer, plan: i.plan || '', level: i.level || '', rate: i.rate ?? '', resident_name: i.resident_name || '', claim_id: i.claim_id || '', from: i.from || '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'payer', 'level', 'rate', 'amount', 'message'],
    sections: (o) => [{ title: 'Payer matrix', rows: o.matrix, columns: ['payer', 'plan', 'level', 'rate', 'benchmark', 'network', 'ends', 'auto_renew'] }],
    limits: [EVERGREEN_LIMITS.files, 'Benchmarks are the numbers you give it, not market data. It reads the rate and dates you list, not the contract language; your contract manager reads the contract.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'contract_notice_send', category: 'binding_send', description: 'Mulberry never sends a termination, renewal or dispute notice to a plan.' }],
  prompt: { title: 'Managed care review', description: 'Walks the host model through a quarterly managed care review with Mulberry.', text: 'You are helping a nursing-home managed care lead with mulberry-of-mco-contracts.\n\nRules: Mulberry reads files only and never sends notices.\n\n1. Call mulberry_check.\n2. Lead with underpayments and expired contracts, then notice dates.\n3. Share the payer matrix with admissions (mulberry_payer_matrix).\n4. Call mulberry_write_report.' },
});
