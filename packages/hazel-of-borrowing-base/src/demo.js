import { runDemo } from 'evergreen-core';

const f = { ar: 'ar-aging.csv', terms: 'terms.json', as_of: '2026-03-31' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Hazel of Borrowing Base', [
  { label: 'Work out the borrowing base', tool: 'hazel_check', args: f, list: (i) => `${i.status.padEnd(21)} ${String(i.amount).padStart(9)}  ${i.message}` },
  { label: 'Write the certificate support', tool: 'hazel_write_report', args: f },
  { label: 'Agent tries to send the certificate itself', tool: 'certificate_submit', args: {} },
]);
