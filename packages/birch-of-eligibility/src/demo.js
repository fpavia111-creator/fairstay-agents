import { runDemo } from 'evergreen-core';

const f = { census: 'census.csv', eligibility: 'eligibility.csv', stays: 'stays.csv', rules: 'rules.json', as_of: '2026-03-02' };
export const demo = (manifest) => runDemo(manifest, new URL('../fixtures', import.meta.url), 'Birch of Eligibility', [
  { label: 'Check eligibility for everyone in the building on 2 March 2026', tool: 'birch_check', args: f, list: (i) => `${i.status.padEnd(22)} ${i.message}` },
  { label: 'Write the business office work list (French page)', tool: 'birch_write_report', args: { ...f, language: 'fr' } },
  { label: 'Teach a plan that waives the 3-day stay', tool: 'birch_learn', args: { kind: 'qualifying_stay_waiver', value: { payer: 'Gulf Coast Advantage HMO (fictional)', note: 'plan contract waives the 3-day stay' } } },
  { label: 'Agent tries to log in to the state portal', tool: 'eligibility_portal_login', args: {} },
]);
