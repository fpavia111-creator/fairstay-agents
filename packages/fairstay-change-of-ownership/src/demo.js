import { runDemo } from 'fairstay-core';

const f = { steps: 'chow-steps.csv', deal: 'deal.json', as_of: '2026-04-01' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Change of Ownership', [
  { label: 'Check the CHOW checklist', tool: 'chow_check', args: f, list: (i) => `${i.status.padEnd(22)} ${i.message}` },
  { label: 'Write the tracker', tool: 'chow_write_report', args: f },
  { label: 'Agent tries to file with the state itself', tool: 'agency_filing_submit', args: {} },
]);
