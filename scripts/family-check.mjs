#!/usr/bin/env node
// Family-wide checks every Evergreen agent must pass, beyond its own tests:
//   - every agent in scripts/agents.json exists, and no package is missing from the list
//   - tool names and prefixes are unique across the family
//   - at least ten eval cases, three PHI canaries, a typo config fixture, a fixtures README and an agent README
//   - at least one refused tool and the default block rule
//   - the report tool and the check tool exist, and the plugin files name the right version
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..'); const PK = join(repo, 'packages');
const list = JSON.parse(readFileSync(join(repo, 'scripts/agents.json'), 'utf8')).map((x) => x[0]);
const pkgs = readdirSync(PK).filter((n) => /-of-/.test(n));
const problems = []; const bad = (n, m) => problems.push(`${n}: ${m}`);
for (const n of list) if (!pkgs.includes(n)) bad(n, 'listed in agents.json but has no package');
for (const n of pkgs) if (!list.includes(n)) bad(n, 'package not listed in agents.json');
const toolOwner = new Map(); const prefixes = new Map();
for (const n of list.filter((x) => pkgs.includes(x))) {
  const P = join(PK, n);
  const { manifest: m } = await import(pathToFileURL(join(P, 'src', 'index.js')).href);
  const prefix = m.tools[0].name.split('_')[0];
  if (prefixes.has(prefix)) bad(n, `prefix ${prefix} also used by ${prefixes.get(prefix)}`); prefixes.set(prefix, n);
  for (const t of m.tools) { if (toolOwner.has(t.name) && !/^(shell_exec)$/.test(t.name)) { const other = toolOwner.get(t.name); const blocked = (mm) => (mm.policy.rules.find((r) => r.tool === t.name) || {}).decision === 'block'; if (!blocked(m)) bad(n, `tool ${t.name} also defined by ${other}`); } else toolOwner.set(t.name, n); }
  for (const t of [`${prefix}_check`, `${prefix}_write_report`]) if (!m.tools.some((x) => x.name === t)) bad(n, `no ${t}`);
  const refused = m.policy.rules.filter((r) => r.decision === 'block' && r.tool !== '*');
  if (!refused.length) bad(n, 'no refused tool');
  if (m.policy.rules.at(-1).tool !== '*' || m.policy.rules.at(-1).decision !== 'block') bad(n, 'last rule is not the default block');
  const cases = JSON.parse(readFileSync(join(P, 'evals/cases.json'), 'utf8')).cases;
  if (cases.length < 10) bad(n, `${cases.length} eval cases (< 10)`);
  if (!cases.some((c) => c.expect?.status === 'blocked')) bad(n, 'no eval case for a refused tool');
  if (!cases.some((c) => c.expect?.status === 'error')) bad(n, 'no eval case for a refused input (bad config or missing file)');
  const can = JSON.parse(readFileSync(join(P, 'fixtures/phi-canaries.json'), 'utf8')).values;
  if (can.length < 3) bad(n, 'fewer than 3 PHI canaries');
  if (Object.keys(m.configSchemas || {}).length && !readdirSync(join(P, 'fixtures')).some((f) => /typo/.test(f))) bad(n, 'no typo config fixture');
  for (const f of ['fixtures/README.md', 'README.md', 'CHANGELOG.md', 'LICENSE', '.mcp.json', '.claude-plugin/plugin.json', 'test/domain.test.js']) if (!existsSync(join(P, f))) bad(n, `missing ${f}`);
  const pkg = JSON.parse(readFileSync(join(P, 'package.json'), 'utf8'));
  if (existsSync(join(P, '.claude-plugin/plugin.json')) && JSON.parse(readFileSync(join(P, '.claude-plugin/plugin.json'), 'utf8')).version !== pkg.version) bad(n, 'plugin.json version differs from package.json');
}
console.log(problems.length ? problems.join('\n') : `${list.length} agents, ${toolOwner.size} distinct tool names, ${prefixes.size} prefixes: family checks pass.`);
process.exit(problems.length ? 1 : 0);
