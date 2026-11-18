import { fileURLToPath } from 'node:url';
import { demoRuntime, printStep } from 'evergreen-core';

export async function demo(manifest) {
  const rt = demoRuntime(manifest, fileURLToPath(new URL('../fixtures', import.meta.url)));
  process.stdout.write(`Oak of Census demo (fictional home, residents and payers) in ${rt.root}\n`);
  const f = { census: 'census-2026-02.csv', billing: 'billing-2026-02.csv', rates: 'rates.json', month: '2026-02' };
  const c = await rt.call('oak_check', f);
  printStep('Compare the February census with the billed days', c);
  for (const i of c.result.items) process.stdout.write(`    ${i.status.padEnd(21)} ${String(i.days).padStart(3)} day(s) ${String(i.amount).padStart(9)}  ${i.message}\n`);
  printStep('Write the business office list (Spanish page)', await rt.call('oak_write_report', { ...f, language: 'es' }));
  printStep('Teach a bed-hold payer from the state notice', await rt.call('oak_learn', { kind: 'bed_hold_payer', value: { payer: 'Lone Star Medicaid (fictional)', note: 'pays up to 3 hospital leave days a year' } }));
  printStep('Agent tries to submit a claim itself', await rt.call('claim_submit', {}));
}
