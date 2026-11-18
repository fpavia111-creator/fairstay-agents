import { runDemo } from 'fairstay-core';

const f = { medicare: 'medicare-claims.csv', crossovers: 'crossovers.csv', rules: 'rules.json', as_of: '2026-04-30' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Crossover Claims', [
  { label: 'Match Medicare coinsurance to Medicaid crossovers', tool: 'crossovers_check', args: f, list: (i) => `${i.status.padEnd(20)} ${String(i.amount).padStart(8)}  ${i.message}` },
  { label: 'Write the crossover and bad debt review', tool: 'crossovers_write_report', args: f },
  { label: 'Agent tries to submit a crossover itself', tool: 'crossover_submit', args: {} },
]);
