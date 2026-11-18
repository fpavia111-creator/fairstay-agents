import { runDemo } from 'fairstay-core';

const f = { opening: 'cash.csv', ar: 'ar-summary.csv', bills: 'bills.csv', plan: 'plan.json', start: '2026-04-06' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay 13 Week Cash Flow', [
  { label: 'Project 13 weeks of cash', tool: 'cashflow_check', args: f, list: (i) => `${i.status.padEnd(20)} ${i.message}` },
  { label: 'Write the projection', tool: 'cashflow_write_report', args: f },
  { label: 'Agent tries to draw on the line itself', tool: 'line_draw', args: {} },
]);
