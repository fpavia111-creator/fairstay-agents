// Builds an Fairstay agent manifest from a short description, so every agent has the same
// shape: one check tool (read), optional extra read tools, one report tool, memory tools,
// optional draft -> one-click pair, and refused tools listed so a host model can see them.
import { defineManifest, MODEL_PIN, memoryTools, refusedTools, reportTool, draftPair, page, LIMITS } from 'fairclaim-core';

export const EVERGREEN_LIMITS = Object.freeze({
  files: 'Reads only the files you give it. It does not log in to PointClickCare, MatrixCare, a payer portal, a bank, a state Medicaid portal or a payroll system.',
  rules: 'Medicare, Medicaid and payroll rules are summarised from public material as of 2026 and the numbers are settings you supply; a billing, payroll or legal professional checks them before you rely on them.',
  advice: 'Not legal, tax, accounting, clinical, reimbursement or HIPAA advice. A person decides what to bill, pay, appeal, file or send.',
  estimate: 'Projections and valuations are arithmetic on the numbers you give it, not forecasts or appraisals.',
  phi: LIMITS.phi,
});

const LIMIT_ARG = { type: 'integer', minimum: 1, maximum: 5000, description: 'Most items to return to the model (the report file always has all of them)' };
const STATUS_ARG = { type: 'string', description: 'Only items with this status' };

/**
 * cfg: {
 *   pkg, prefix, title, description,
 *   args: { name: schema }            file and option arguments shared by check and report
 *   required: [names],
 *   sources: { key: { label, args: [argName], fields } },
 *   configSchemas, memoryKinds,
 *   run(a, ctx) -> out                pure-ish: reads files through ctx, returns { items, ... }
 *   summary(out) -> string,
 *   check: { title, description },
 *   reads: [{ name, title, description, properties, required, run(a, ctx) -> { summary, ... } }],
 *   report: { title, base, rows(out), htmlColumns, sections(out), limits },
 *   drafts: draftPair cfg (optional),
 *   refused: [{ name, category, description }],
 *   prompt: { title, description, text, arguments }
 * }
 */
export function snfAgent(cfg) {
  const { pkg, prefix } = cfg;
  const out = `evergreen-out/${prefix}`;
  const MEMORY = memoryTools(prefix, cfg.memoryKinds || {});
  const refused = refusedTools(cfg.refused || []);
  const drafts = cfg.drafts ? draftPair({ prefix, outDir: out, ...cfg.drafts }) : { tools: [], rules: [] };
  const checkName = `${prefix}_check`;
  const tools = [
    {
      name: checkName, kind: 'read', title: cfg.check.title, description: cfg.check.description,
      inputSchema: { type: 'object', additionalProperties: false, required: cfg.required || [], properties: { ...cfg.args, status: STATUS_ARG, limit: LIMIT_ARG } },
      handler: async (a, ctx) => {
        const o = await cfg.run(a, ctx);
        const items = a.status ? (o.items || []).filter((i) => i.status === a.status) : (o.items || []);
        const { items: _drop, ...rest } = o;
        return { summary: cfg.summary(o), ...rest, ...page(items, a.limit || 100) };
      },
    },
    ...(cfg.reads || []).map((r) => ({
      name: r.name, kind: 'read', title: r.title, description: r.description,
      inputSchema: { type: 'object', additionalProperties: false, required: r.required || [], properties: r.properties },
      handler: async (a, ctx) => r.run(a, ctx),
    })),
    reportTool({
      name: `${prefix}_write_report`, title: cfg.report.title.en || cfg.report.title, outDir: out, base: cfg.report.base,
      description: cfg.report.description || `Write ${cfg.report.base}.csv (one row per item, with blank owner and decision columns) and ${cfg.report.base}.html into out_dir (default ${out}).`,
      properties: cfg.args, required: cfg.required || [],
      build: async (a, ctx) => {
        const o = await cfg.run(a, ctx);
        const rows = cfg.report.rows(o).map((r) => ({ ...r, owner: '', decision: '' }));
        return {
          title: cfg.report.title, intro: cfg.summary(o), rows, summary: `${cfg.report.title.en || cfg.report.title} written: ${cfg.summary(o)}`,
          columns: rows.length ? Object.keys(rows[0]) : ['status', 'owner', 'decision'],
          htmlColumns: cfg.report.htmlColumns, sections: cfg.report.sections ? cfg.report.sections(o) : [],
          limits: cfg.report.limits || [EVERGREEN_LIMITS.files, EVERGREEN_LIMITS.rules, EVERGREEN_LIMITS.advice],
        };
      },
    }),
    ...drafts.tools,
    ...MEMORY.tools,
    ...refused.tools,
  ];
  return defineManifest({
    name: pkg.name, version: pkg.version, description: cfg.description, model: MODEL_PIN,
    caps: { maxSteps: 60, maxSpendUsd: 0 },
    configSchemas: cfg.configSchemas || {},
    memory: { prefix, kinds: cfg.memoryKinds || {} },
    sources: cfg.sources || {},
    argDocs: cfg.argDocs || {},
    prompts: cfg.prompt ? [{ name: `${prefix}_review`, arguments: [], ...cfg.prompt }] : [],
    tools,
    policy: { rules: [
      { tool: checkName, decision: 'allow' },
      ...(cfg.reads || []).map((r) => ({ tool: r.name, decision: 'allow' })),
      { tool: `${prefix}_write_report`, decision: 'allow' },
      ...drafts.rules,
      ...MEMORY.rules,
      ...refused.rules,
      { tool: '*', decision: 'block', reason: `Not on the ${cfg.title} allowlist.` },
    ] },
  });
}

/** Standard file argument. */
export const fileArg = (description) => ({ type: 'string', description });
export const DATE_ARG = (description) => ({ type: 'string', format: 'date', description });
export const MONTH_ARG = { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Month to check, YYYY-MM' };
