import { runDemo } from 'evergreen-core';

const f = { tb: 'tb-2026-03.csv', tasks: 'close-tasks.csv', suspense: 'suspense-detail.csv', rules: 'rules.json', as_of: '2026-04-06' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Sycamore of Close', [
  { label: 'Check the March close', tool: 'sycamore_check', args: f, list: (i) => `${i.status.padEnd(25)} ${i.message}` },
  { label: 'Write the close review', tool: 'sycamore_write_report', args: f },
  { label: 'Agent tries to post a journal itself', tool: 'journal_post', args: {} },
]);
