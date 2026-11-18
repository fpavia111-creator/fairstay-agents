import { runDemo } from 'evergreen-core';

const f = { census: 'census-fy2025.csv', cost_report: 'cost-report-days.csv', psr: 'psr.csv', pbc: 'pbc.csv', rules: 'rules.json', start: '2025-01-01', end: '2025-12-31', as_of: '2026-04-15' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Chestnut of Cost Report', [
  { label: 'Tie out 2025 patient days', tool: 'chestnut_check', args: f, list: (i) => `${i.status.padEnd(24)} ${i.message}` },
  { label: 'Write the tie-out', tool: 'chestnut_write_report', args: f },
  { label: 'Agent tries to file the cost report itself', tool: 'cost_report_file', args: {} },
]);
