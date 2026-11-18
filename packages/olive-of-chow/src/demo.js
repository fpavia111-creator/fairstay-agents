import { runDemo } from 'evergreen-core';

const f = { steps: 'chow-steps.csv', deal: 'deal.json', as_of: '2026-04-01' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Olive of CHOW', [
  { label: 'Check the CHOW checklist', tool: 'olive_check', args: f, list: (i) => `${i.status.padEnd(22)} ${i.message}` },
  { label: 'Write the tracker', tool: 'olive_write_report', args: f },
  { label: 'Agent tries to file with the state itself', tool: 'agency_filing_submit', args: {} },
]);
