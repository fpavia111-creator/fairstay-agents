import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'fairclaim-core';

/**
 * Run a demo on the bundled fictional fixtures.
 * steps: [{ label, tool, args, list?: (item) => string, approve?: true }]
 * An args function receives the earlier results ({ [tool]: result }).
 */
export async function runDemo(manifest, fixturesUrl, title, steps) {
  const rt = demoRuntime(manifest, fileURLToPath(fixturesUrl));
  process.stdout.write(`${title} demo (fictional home, residents, staff and vendors) in ${rt.root}\n`);
  const seen = {};
  for (const s of steps) {
    const args = typeof s.args === 'function' ? s.args(seen) : s.args || {};
    let r = await rt.call(s.tool, args);
    if (s.approve && r.status === 'needs_approval') { rt.approvals.approve(r.approval_id, 'Demo Reviewer (fictional)'); r = await rt.call(s.tool, args); }
    printStep(s.label, r);
    if (s.list && r.result && r.result.items) for (const i of r.result.items.slice(0, 12)) process.stdout.write(`    ${s.list(i)}\n`);
    seen[s.tool] = r.result;
  }
  return rt;
}
