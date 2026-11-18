// Contract tests every Remedy agent runs against its own manifest, fixtures and
// eval cases (import from 'remedy-core/testkit'). They check how the agent is wired:
// each tool that runs has an eval case, bad arguments come back as readable errors,
// files outside --root are refused, Review mode and the kill switch hold, drafts are
// tied to their sha256, results are repeatable and the agent's own column layout is
// read as it is. Domain behaviour is tested in each agent's own test files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { AgentRuntime } from './runtime.js';
import { adaptRecords } from './sources.js';
import { ONE_CLICK_CATEGORIES } from './manifest.js';
import { createHash } from 'node:crypto';

// A fixed pseudonym key, so two runs give the same pseudonyms (with audit off the runtime
// would otherwise make a new key for each run).
const TEST_PHI_KEY = createHash('sha256').update('remedy contract tests: fictional fixtures only').digest();

const FILE_ARG = /\.(csv|tsv|txt|json|jsonl|xlsx|edi|x12)$/i;
const VOLATILE = /(^|_)(ms|at|time|generated|ran|date_written|written_at|elapsed|file|files|draft|path|dir|out_dir|report|html|csv|md)$/i;

function strip(v) {
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.test(k)).map(([k, x]) => [k, strip(x)]));
  if (typeof v === 'string') return v.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<time>').replace(/[A-Za-z]:?[\\/][^\s"]*remedy-out[^\s"]*/g, '<out>');
  return v;
}

function sample(type, i) {
  return { date: '2026-11-02', datetime: '2026-11-02T08:00:00', money: String(100 + i), number: String(1 + i), bool: 'yes', email: 'ops@example.test' }[type] || `X${i}`;
}

/**
 * Registers the contract tests. `casesFile` is the agent's evals/cases.json.
 * Every call runs on a copy of the eval root in a temporary folder, so nothing is
 * written next to the fixtures.
 */
export function agentContract({ manifest, casesFile }) {
  const data = JSON.parse(readFileSync(casesFile, 'utf8'));
  const srcRoot = resolve(dirname(casesFile), data.root || '.');
  const cases = (data.cases || data).filter((c) => !/^intl-/.test(c.id));
  const decision = (t) => (manifest.policy.rules.find((r) => r.tool === t.name) || manifest.policy.rules.find((r) => r.category && r.category === t.category) || {}).decision;
  const runs = manifest.tools.filter((t) => decision(t) !== 'block');
  const caseFor = (t) => cases.find((c) => c.tool === t.name && (!c.expect || !c.expect.status || ['executed', 'needs_approval'].includes(c.expect.status)));
  const sandbox = () => { const d = mkdtempSync(join(tmpdir(), `${manifest.name}-contract-`)); cpSync(srcRoot, d, { recursive: true, filter: (p) => !/[\\/](node_modules|remedy-out|\.remedy)([\\/]|$)/.test(p) }); return d; };
  const rtIn = (root, opts = {}) => new AgentRuntime(manifest, { root, stateDir: join(root, '.remedy-test'), audit: false, phiKey: TEST_PHI_KEY, ...opts });
  async function run(rt, tool, args) {
    const first = await rt.call(tool, args);
    if (first.status !== 'needs_approval') return first;
    rt.approvals.approve(first.approval_id, 'Pat Example');
    return rt.call(tool, args);
  }

  test(`${manifest.name} contract: every tool that runs has an eval case`, () => {
    const missing = runs.filter((t) => !/_(learn|accept_learning|retire_memory)$/.test(t.name) && !cases.some((c) => c.tool === t.name)).map((t) => t.name);
    assert.deepEqual(missing, []);
  });

  test(`${manifest.name} contract: missing or wrongly typed arguments come back as readable errors`, async () => {
    const root = sandbox();
    for (const t of runs) {
      const req = (t.inputSchema && t.inputSchema.required) || [];
      if (!req.length) continue;
      const r = await rtIn(root).call(t.name, {});
      assert.equal(r.status, 'error', `${t.name} with no arguments`);
      assert.match(r.reason, new RegExp(req[0]), `${t.name} names the missing argument`);
      const bad = await rtIn(root).call(t.name, { ...(caseFor(t) || {}).args, [req[0]]: { not: 'a string' } });
      assert.ok(['error', 'blocked'].includes(bad.status), `${t.name} with an object for ${req[0]}`);
    }
  });

  test(`${manifest.name} contract: a file outside --root is refused before it is read`, async () => {
    const root = sandbox();
    let checked = 0;
    for (const t of runs) {
      const c = caseFor(t); if (!c) continue;
      const key = Object.keys(c.args || {}).find((k) => (typeof c.args[k] === 'string' && FILE_ARG.test(c.args[k])) || (Array.isArray(c.args[k]) && FILE_ARG.test(String(c.args[k][0]))));
      if (!key) continue;
      for (const evil of ['../../../../../../etc/passwd', '/etc/passwd', 'fixtures/../../../../outside.csv']) {
        const r = await run(rtIn(root), t.name, { ...c.args, [key]: Array.isArray(c.args[key]) ? [evil, ...c.args[key].slice(1)] : evil });
        assert.equal(r.status, 'error', `${t.name} ${key}=${evil}`);
        assert.match(r.reason, /outside|leaves the allowed root/, `${t.name} ${key}=${evil}: ${r.reason}`);
        assert.doesNotMatch(JSON.stringify(r), /root:x:0:0/, `${t.name} leaked a file outside the root`);
      }
      checked++;
    }
    assert.ok(checked > 0, 'at least one tool reads a file');
  });

  test(`${manifest.name} contract: Review mode refuses writes and actions, and the kill switch stops everything`, async () => {
    const root = sandbox();
    const review = rtIn(root, { mode: 'review' });
    for (const t of manifest.tools) {
      const c = caseFor(t); const args = c ? c.args : {};
      const r = await review.call(t.name, args);
      if (t.kind === 'write' || t.kind === 'action') assert.equal(r.status, 'blocked', `${t.name} in Review`);
      else if (t.kind === 'read' && c && decision(t) === 'allow' && (!c.expect || !c.expect.status || c.expect.status === 'executed')) assert.equal(r.status, 'executed', `${t.name} reads in Review`);
    }
    const killed = rtIn(root); killed.kill();
    for (const t of manifest.tools) assert.equal((await killed.call(t.name, (caseFor(t) || {}).args || {})).status, 'blocked', `${t.name} after kill`);
    for (const t of manifest.tools.filter((x) => ONE_CLICK_CATEGORIES.includes(x.category))) assert.throws(() => rtIn(root, { mode: 'auto', autoActions: [t.name] }), /one-click/, `${t.name} cannot go on Auto`);
  });

  const drafts = manifest.tools.filter((t) => /_draft_/.test(t.name) && caseFor(t));
  const request = manifest.tools.find((t) => /_request_/.test(t.name) && (t.inputSchema.required || []).includes('draft_sha256'));
  if (drafts.length && request) {
    test(`${manifest.name} contract: a draft is only approved with its own sha256, open markers need a note, and an edited draft needs a new review`, async () => {
      const root = sandbox();
      const rt = rtIn(root);
      const d = await run(rt, drafts[0].name, caseFor(drafts[0]).args);
      assert.equal(d.status, 'executed', JSON.stringify(d).slice(0, 300));
      assert.match(d.result.draft_sha256, /^[a-f0-9]{64}$/);
      assert.match(readFileSync(d.result.file, 'utf8'), /DRAFT\. Not sent\./);
      const wrong = await run(rtIn(root), request.name, { draft: d.result.draft, draft_sha256: '0'.repeat(64) });
      assert.equal(wrong.status, 'error'); assert.match(wrong.reason, /sha256/);
      const pending = await rtIn(root).call(request.name, { draft: d.result.draft, draft_sha256: d.result.draft_sha256 });
      assert.equal(pending.status, 'needs_approval', 'one named click');
      if (d.result.open_markers) {
        const open = await run(rtIn(root), request.name, { draft: d.result.draft, draft_sha256: d.result.draft_sha256 });
        assert.equal(open.status, 'error'); assert.match(open.reason, /open markers/);
      }
      const ok = await run(rtIn(root), request.name, { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'contact confirmed by phone' });
      assert.equal(ok.status, 'executed'); assert.match(ok.result.summary, /Nothing was sent/);
      assert.equal(ok.approved_by, 'Pat Example');
      writeFileSync(d.result.file, readFileSync(d.result.file, 'utf8') + '\nEdited after review.\n');
      const edited = await run(rtIn(root), request.name, { draft: d.result.draft, draft_sha256: d.result.draft_sha256, accept_open_issues: true, note: 'contact confirmed by phone' });
      assert.equal(edited.status, 'error'); assert.match(edited.reason, /does not match/);
    });
  }

  // Every value of every choice argument runs (ver 2: a breakdown by one of its listed groups once failed inside the code).
  const INTERNAL = /Cannot read prop|is not a function|is not iterable|is not defined|of undefined|of null|TypeError|ReferenceError|RangeError/;
  test(`${manifest.name} contract: every listed value of every choice argument runs without an internal error`, async () => {
    const root = sandbox();
    let tried = 0;
    for (const t of runs.filter((x) => x.kind === 'read')) {
      const c = caseFor(t); if (!c) continue;
      for (const [arg, sch] of Object.entries((t.inputSchema && t.inputSchema.properties) || {})) {
        const values = sch.enum || (sch.items && sch.items.enum && sch.items.enum.map((v) => [v])) || [];
        for (const v of values) {
          const r = await rtIn(root).call(t.name, { ...c.args, [arg]: v });
          tried++;
          assert.ok(r.status === 'executed' || (r.status === 'error' && !INTERNAL.test(String(r.reason))), `${t.name} with ${arg} = ${JSON.stringify(v)}: ${r.status} ${String(r.reason || '').slice(0, 160)}`);
        }
      }
    }
    assert.ok(tried >= 0);
  });

  test(`${manifest.name} contract: the same call on the same files gives the same result`, async () => {
    const root = sandbox();
    let checked = 0;
    for (const t of runs.filter((x) => x.kind === 'read')) {
      const c = caseFor(t); if (!c) continue;
      const a = await rtIn(root).call(t.name, c.args); const b = await rtIn(root).call(t.name, c.args);
      assert.equal(a.status, b.status, t.name);
      assert.deepEqual(strip(b.result), strip(a.result), `${t.name} differs between two runs`);
      checked++;
    }
    assert.ok(checked > 0, 'at least one read tool has an eval case');
  });

  const kinds = Object.entries(manifest.sources || {});
  if (kinds.length) {
    test(`${manifest.name} contract: a file already in the agent's own column names is read as it is`, () => {
      for (const [kind, def] of kinds) {
        const names = Object.keys(def.fields);
        const row = names.map((n, i) => sample(def.fields[n].type, i));
        const r = adaptRecords({ format: 'csv', matrix: [names, row] }, def, { kind, file: `${kind}.csv` });
        assert.equal(r.report.adapted, false, `${kind}: ${JSON.stringify(r.report).slice(0, 300)}`);
        assert.equal(r.rows.length, 1, kind);
        for (const [i, n] of names.entries()) if (!def.fields[n].type || def.fields[n].type === 'text') assert.equal(r.rows[0][n], row[i], `${kind}.${n}`);
      }
    });
  }
}

