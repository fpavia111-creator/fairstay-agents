import { runDemo } from 'fairstay-core';

const f = { census: 'census.csv', stays: 'stays.csv', rules: 'rules.json', as_of: '2026-03-17' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Fairstay Length of Stay', [
  { label: 'Build the weekly meeting list', tool: 'los_check', args: f, list: (i) => `${i.status.padEnd(21)} ${i.message}` },
  { label: 'Write the meeting list', tool: 'los_write_report', args: f },
  { label: 'Agent tries to deliver a notice itself', tool: 'notice_deliver', args: {} },
]);
