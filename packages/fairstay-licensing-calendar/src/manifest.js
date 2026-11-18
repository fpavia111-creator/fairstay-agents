import { readFileSync } from 'node:fs';
import { snfAgent, fileArg, DATE_ARG, EVERGREEN_LIMITS, today, RESIDENT_NAME } from 'fairstay-core';
import { checkLicensing } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
export const ITEM_FIELDS = Object.freeze({
  item: { aliases: ['Item', 'License', 'Certificate', 'Credential', 'Type'], required: true },
  facility: { aliases: ['Facility', 'Building', 'Location'] },
  holder: { aliases: ['Holder', 'Employee', 'Name', 'Licensee'], phi: 'name' },
  role: { aliases: ['Role', 'Position', 'Title', 'Discipline'] },
  number: { aliases: ['Number', 'License Number', 'License #', 'Certificate Number', 'PTAN'], phi: 'account' },
  expires: { aliases: ['Expires', 'Expiration', 'Expiration Date', 'Exp Date', 'Due', 'Revalidation Due'], type: 'date' },
  renewal_filed: { aliases: ['Renewal Filed', 'Renewal Submitted', 'Filed'], type: 'date' },
});
export const STAFF_FIELDS = Object.freeze({ name: { ...RESIDENT_NAME, aliases: ['Employee', 'Employee Name', 'Name', 'Staff'], required: true }, role: { aliases: ['Role', 'Position', 'Job Title', 'Title'], required: true }, facility: { aliases: ['Facility', 'Building', 'Location'] } });
const RULES_SCHEMA = { type: 'object', additionalProperties: false, properties: { warn_days: { type: 'integer', minimum: 1, maximum: 365, description: 'Flag items expiring within this many days (default 60)' }, facilities: { type: 'array', items: { type: 'string' }, description: 'Facility names to check for the standard items' }, licensed_roles: { type: 'array', items: { type: 'string' }, description: 'Roles that need a license on the list (default RN, LPN, LVN, CNA, Administrator, NHA, PT, OT, SLP, RD)' } } };
export const MEMORY_KINDS = Object.freeze({ licensing_note: { description: 'A note on a state rule, e.g. {"note": "Texas renews the facility license every 3 years"}.', effect: 'is shown with results. It never changes a check.', schema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 300 } } } } });
const args = {
  items: fileArg('Licenses and certificates under --root: item, facility, holder, role, number, expiration date, renewal filed date'),
  staff: fileArg('Optional staff roster: name, role, facility (licensed roles must have a license on the list)'),
  rules: fileArg('Optional rules JSON: warn_days, facilities, licensed_roles'),
  as_of: DATE_ARG('Status date (YYYY-MM-DD, default today)'),
};
const run = (a, ctx) => { const r = a.rules ? ctx.readJson(a.rules, 'licensing_rules') : {}; return checkLicensing(ctx.records(a.items, 'items'), a.staff ? ctx.records(a.staff, 'staff') : [], { asOf: a.as_of || today(), warnDays: r.warn_days, facilities: r.facilities || [], licensedRoles: r.licensed_roles }); };
const summary = (o) => `${o.items_on_list} item(s) on the list, ${o.facilities} facilit${o.facilities === 1 ? 'y' : 'ies'}, ${o.staff_checked} licensed staff checked. ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'Nothing to act on'}.`;

export const manifest = snfAgent({
  pkg, prefix: 'licensing', title: 'Fairstay Licensing Calendar',
  description: 'Licensing and credentialing calendar for nursing homes: facility licenses, Medicare and Medicaid revalidations, CLIA and other certificates, administrator and nurse licenses. Flags expired and expiring items, renewals pending past expiry, licensed staff with no license on file, and standard items missing for a facility. Staff names and license numbers are masked before results reach the model.',
  args, required: ['items'],
  sources: { items: { label: 'Licenses and certificates', args: ['items'], fields: ITEM_FIELDS }, staff: { label: 'Staff roster', args: ['staff'], fields: STAFF_FIELDS } },
  configSchemas: { licensing_rules: RULES_SCHEMA }, memoryKinds: MEMORY_KINDS, run, summary,
  check: { title: 'Check licenses and certificates', description: 'Check every license, certificate and revalidation date, licensed staff against the list, and each facility against the standard items.' },
  report: {
    title: { en: 'Licensing calendar', es: 'Calendario de licencias', de: 'Lizenzkalender', fr: 'Calendrier des licences', pt: 'Calendário de licenças', it: 'Calendario delle licenze', ja: '免許・認定カレンダー', zh: '执照日历', ko: '면허 일정표' },
    base: 'licensing',
    rows: (o) => o.items.map((i) => ({ status: i.status, facility: i.facility || '', item: i.item, holder: i.holder || '', role: i.role || '', number: i.number || '', expires: i.expires || '', days_left: i.days_left ?? '', renewal_filed: i.renewal_filed || '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'facility', 'item', 'holder', 'expires', 'days_left', 'message'],
    limits: [EVERGREEN_LIMITS.files, 'The standard list and renewal cycles are typical, not your state\'s rules. It does not look anything up on a state license site; verify there before you rely on a date.', EVERGREEN_LIMITS.advice],
  },
  refused: [{ name: 'license_renewal_submit', category: 'binding_send', description: 'Fairstay Licensing Calendar never files a renewal or revalidation with a state or CMS.' }],
  prompt: { title: 'Licensing review', description: 'Walks the host model through a monthly licensing review with Fairstay Licensing Calendar.', text: 'You are helping a nursing-home compliance lead with fairstay-licensing-calendar.\n\nRules: Fairstay Licensing Calendar reads files only and never files a renewal.\n\n1. Call licensing_check.\n2. Lead with expired items and licensed staff with no license on file.\n3. Call licensing_write_report for the compliance meeting.' },
});
