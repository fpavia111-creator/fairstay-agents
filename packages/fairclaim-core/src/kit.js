// Building blocks the Fairclaim agents share: worklist files, the
// draft → one-click request pair, refused tools, and small table helpers.
// Every agent still owns its own manifest and policy; these only remove repetition.
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toCsv } from './csv.js';
import { sha256, safePath } from './util.js';
import { escapeHtml, htmlPage, safeMarkdown, safeFileName } from './formats.js';
import { reportText } from './report-text.js';

export const MODEL_PIN = Object.freeze({ provider: 'anthropic', id: 'claude-sonnet-5-5', note: 'Declared host-model pin. The tools are deterministic and call no model.' });
export const OPEN_MARKER = /\[(TO CONFIRM|MISSING|CHECK|ATTACH)[^\]]*\]/g;

const rel = (ctx, f) => relative(ctx.root, f).split('\\').join('/');

/** Hash of several output files (name + content hash), recorded in the audit line. */
export const filesHash = (files) => sha256(files.map((f) => `${String(f).split(/[\\/]/).pop()}:${sha256(readFileSync(f))}`).join('\n'));

/** Append one row to a CSV log, writing the header the first time. */
export function appendRow(dir, name, row, columns) {
  const f = join(dir, name);
  const csv = toCsv([row], columns);
  appendFileSync(f, existsSync(f) ? csv.split('\n').slice(1).join('\n') : csv);
  return f;
}

/** A small HTML table from rows. Values are escaped. labels: { column: heading } or a function. */
export function htmlTable(rows, columns, labels = {}, none = 'None.') {
  if (!rows.length) return `<p class="mut">${escapeHtml(none)}</p>`;
  const lab = (c) => (typeof labels === 'function' ? labels(c) : labels[c] || c.replace(/_/g, ' '));
  const head = columns.map((c) => `<th>${escapeHtml(lab(c))}</th>`).join('');
  const body = rows.map((r) => `<tr>${columns.map((c) => { const v = r[c]; return `<td>${escapeHtml(v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v))}</td>`; }).join('')}</tr>`).join('\n');
  return `<table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table>`;
}

/**
 * Write a worklist as CSV (for people to fill in) and HTML (to read), plus an
 * optional summary block. Returns { files, output_sha256, lang }.
 *
 * The HTML is written in ctx.lang (or `lang`): title and section titles may be
 * { en, de, ... } objects, column headings come from the shared report glossary,
 * and the page says the reason sentences stay in English. The CSV keeps the
 * column names as they are, so spreadsheets and scripts read it the same way in
 * every language. Both files hold real patient data (they are for the people
 * working the claims); only results returned to a model are masked.
 */
export function writeWorklist(ctx, dir, base, { title, intro = '', rows, columns, htmlColumns, labels = {}, sections = [], limits = [], lang }) {
  const rt = reportText(lang || ctx.lang);
  const out = ctx.outDir(dir);
  const csv = ctx.writeFile(out, `${base}.csv`, toCsv(rows, columns));
  const lab = (c) => labels[c] ? rt.title(labels[c]) : rt.column(c);
  const ttl = rt.title(title);
  const notes = [rt.t('review_note'), rt.t('reasons_english')].filter(Boolean);
  const body = [
    `<h1>${escapeHtml(ttl)}</h1>`,
    intro ? `<p class="mut">${escapeHtml(rt.title(intro))}</p>` : '',
    notes.length ? `<p class="mut">${escapeHtml(notes.join(' '))}</p>` : '',
    ...sections.map((s) => `<h2>${escapeHtml(rt.title(s.title))}</h2>${s.html || htmlTable(s.rows || [], s.columns || [], lab, rt.t('none'))}`),
    `<h2>${escapeHtml(rt.t('all_rows', { n: rows.length }))}</h2>`,
    htmlTable(rows, htmlColumns || columns, lab, rt.t('none')),
    limits.length ? `<h2>${escapeHtml(rt.t('limits'))}</h2><ul>${limits.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : '',
  ].join('\n');
  const html = ctx.writeFile(out, `${base}.html`, htmlPage({ title: ttl, bodyHtml: body, footer: rt.t('footer'), lang: rt.lang }));
  const files = [csv, html];
  return { files: files.map((f) => rel(ctx, f)), output_sha256: filesHash(files), lang: rt.lang };
}

/** Tools listed so a host model can see them and see they are refused. */
export function refusedTools(list) {
  return {
    tools: list.map(({ name, category, description }) => ({ name, kind: 'action', category, description: `Listed so agents can see it is refused. ${description}`, inputSchema: { type: 'object', additionalProperties: false, properties: {} } })),
    rules: list.map(({ name, reason, description }) => ({ tool: name, decision: 'block', reason: reason || description })),
  };
}

const str = { type: 'string' };

/**
 * The draft → one-click pair.
 *
 *   <prefix>_draft_<noun>     kind 'write': writes drafts/<noun>-<id>.md marked DRAFT and returns its sha256.
 *   <prefix>_request_<verb>   kind 'action' in a one-click category: re-hashes the draft, refuses if it
 *                             changed or still has open markers (unless accept_open_issues with a note),
 *                             then appends an approved row to <noun>-requests.csv. A person acts on it.
 *
 * cfg: { prefix, noun, verb, category, outDir, title, description, args (properties), required,
 *        build(a, ctx) → { id, to, text }, requestDescription, actor }
 */
export function draftPair(cfg) {
  const { prefix, noun, verb = 'send', category = 'binding_send', outDir, actor = 'a person' } = cfg;
  const draftName = `${prefix}_draft_${noun}`, reqName = `${prefix}_request_${verb}`;
  const draftTool = {
    name: draftName, kind: 'write', title: cfg.title || `Draft a ${noun.replace(/_/g, ' ')}`,
    description: cfg.description,
    inputSchema: { type: 'object', additionalProperties: false, required: cfg.required || [], properties: { ...cfg.args, out_dir: str } },
    handler: async (a, ctx) => {
      const d = await cfg.build(a, ctx);
      const header = `> DRAFT. Not sent. Written by ${ctx.manifest ? ctx.manifest.name : prefix} on ${new Date().toISOString().slice(0, 10)} from your files. Check every figure before ${actor} uses it.\n\n`;
      const text = safeMarkdown(header + d.text);
      const dir = join(ctx.outDir(a.out_dir || outDir), 'drafts');
      // The file name carries a short hash of the id, never the id: a claim or account number in a
      // path would reach the model unmasked (or, masked, the path would no longer open).
      const f = ctx.writeFile(dir, `${noun}-${sha256(String(d.id)).slice(0, 12)}.md`, text);
      const markers = [...new Set((text.match(OPEN_MARKER) || []))];
      return { summary: `${noun.replace(/_/g, ' ')} ${d.id} drafted${d.amount !== undefined ? ` for ${d.amount}` : ''} with ${markers.length} open marker(s)${markers.length ? ` (${markers.join(', ')})` : ''}. Nothing was sent.`, id: d.id, to: d.to || null, amount: d.amount ?? null, draft: rel(ctx, f), draft_sha256: sha256(text), open_markers: markers.length, markers, file: f, ...(d.extra || {}) };
    },
  };
  const reqTool = {
    name: reqName, kind: 'action', category, title: `Approve the ${noun.replace(/_/g, ' ')} (one click)`,
    description: cfg.requestDescription || `After one named human click (even in Auto), record that the reviewed ${noun.replace(/_/g, ' ')} draft is approved in ${noun}-requests.csv. Tied to draft_sha256; refuses while open markers remain unless accept_open_issues is true with a note. ${actor[0].toUpperCase() + actor.slice(1)} acts on it; the agent never does.`,
    inputSchema: { type: 'object', additionalProperties: false, required: ['draft', 'draft_sha256'], properties: { draft: { type: 'string', description: 'Draft path returned by the draft tool' }, draft_sha256: { type: 'string', description: 'sha256 returned by the draft tool' }, to: { type: 'string', description: 'Who it goes to; must match the draft when the draft names someone' }, accept_open_issues: { type: 'boolean' }, note: str, out_dir: str } },
    handler: async (a, ctx) => {
      const f = safePath(ctx.root, a.draft);
      const text = readFileSync(f, 'utf8');
      if (sha256(text) !== a.draft_sha256) throw new Error('draft_sha256 does not match the draft on disk; review the current draft and pass its new sha256');
      const open = [...new Set(text.match(OPEN_MARKER) || [])];
      if (open.length && !(a.accept_open_issues === true && String(a.note || '').trim())) throw new Error(`the draft still has open markers (${open.join(', ')}); fix them, or pass accept_open_issues: true with a note saying why`);
      const toLine = (/^\*\*To:\*\*\s*(.+)$/m.exec(text) || [])[1];
      if (a.to && toLine && !/^\[TO CONFIRM/.test(toLine) && toLine.trim() !== String(a.to).trim()) throw new Error(`to ("${a.to}") differs from the draft's To line ("${toLine.trim()}")`);
      const id = (new RegExp(`${noun}-(.+)\\.md$`).exec(f.split(/[\\/]/).pop()) || [])[1] || '';
      const file = appendRow(ctx.outDir(a.out_dir || outDir), `${noun}-requests.csv`, { approved_at: new Date().toISOString(), id, to: a.to || toLine || '', draft: rel(ctx, f), draft_sha256: a.draft_sha256, open_markers: open.length, note: a.note || '', status: `approved - ${actor} acts on it` }, ['approved_at', 'id', 'to', 'draft', 'draft_sha256', 'open_markers', 'note', 'status']);
      return { summary: `${noun.replace(/_/g, ' ')} ${id} approved and recorded. Nothing was sent or paid by the agent.`, file: rel(ctx, file) };
    },
  };
  return { tools: [draftTool, reqTool], rules: [{ tool: draftName, decision: 'ask', reason: 'A draft is written only after a person says yes (or Auto is opted in).' }, { tool: reqName, decision: 'ask', reason: `${category}: one named human click, even in Auto.` }] };
}

/** Standard one-line limit sentences used in reports. */
export const LIMITS = Object.freeze({
  files: 'Reads only the files you give it. It does not log in to a payer portal, clearinghouse, practice-management system, EHR or bank.',
  contract: 'Amounts are checked against the fee schedule or contract file you supply. It does not know a payer\'s current rules or policies.',
  codes: 'Code checks look at shape and at the tables you supply (or the short built-in reason-code list). It is not a certified coding product and does not hold the CPT, CDT or ICD-10 code sets.',
  advice: 'Not legal, medical, coding-compliance or HIPAA advice. A person decides what to bill, appeal, refund or write off.',
  phi: 'Results returned to the AI model have patient names, birth dates, member ids and other direct identifiers masked. The files written here keep the real values: keep them in a secure folder.',
});

// ------------------------------------------------------------ tool builders ----

const OUT_DIR_ARG = { type: 'string', description: 'Folder under --root for the files (default remedy-out/<agent>)' };

/**
 * A report tool: runs build(a, ctx) → { title, intro, rows, columns, htmlColumns?, sections?, limits?, summary, base?, extra? }
 * and writes <base>.csv and <base>.html with writeWorklist (in ctx.lang, or the call's `language`).
 */
export function reportTool({ name, title, description, properties = {}, required = [], outDir, base, build }) {
  return {
    name, kind: 'report', title, description,
    inputSchema: { type: 'object', additionalProperties: false, required, properties: { ...properties, out_dir: OUT_DIR_ARG, language: { type: 'string', enum: ['en', 'de', 'fr', 'es', 'pt', 'it', 'ja', 'zh', 'ko'], description: 'Language of the HTML page (default: --lang or REMEDY_LANG, else English). The CSV keeps its column names.' } } },
    handler: async (a, ctx) => {
      const r = await build(a, ctx);
      const w = writeWorklist(ctx, a.out_dir || outDir, r.base || base, { title: r.title, intro: r.intro, rows: r.rows, columns: r.columns || Object.keys(r.rows[0] || {}), htmlColumns: r.htmlColumns, sections: r.sections || [], limits: r.limits || [], lang: a.language, labels: r.labels || {} });
      return { summary: `${r.summary} Files: ${w.files.join(', ')}.`, ...w, ...(r.extra || {}) };
    },
  };
}

/** Find one item by an id the model passed back (the real id or its pseudonym in strict mode). */
export function findItem(items, key, given, ctx, { kind = 'claim', label = key } = {}) {
  const g = String(given ?? '').trim();
  const hit = items.find((x) => (ctx && ctx.phi ? ctx.phi.same(x[key], g, kind) : String(x[key]).trim() === g));
  if (!hit) throw new Error(`${label} ${g} not found; pass a ${label} from the check's result`);
  return hit;
}

/** Count items by a key into { value: n }, sorted by count. */
export function tally(items, key) {
  const m = {};
  for (const x of items) { const k = typeof key === 'function' ? key(x) : x[key]; if (k === undefined || k === null || k === '') continue; for (const v of [].concat(k)) m[v] = (m[v] || 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
}

/** Roll items up by a key into rows { [key], count, amount, claims } sorted by amount, then count. */
export function rollup(items, key, { amount = 'amount', label = typeof key === 'string' ? key : 'name' } = {}) {
  const m = new Map();
  for (const x of items) {
    const k = (typeof key === 'function' ? key(x) : x[key]) ?? 'unknown';
    const r = m.get(k) || { [label]: k, count: 0, amount: 0, claims: new Set() };
    r.count++; r.amount = Math.round((r.amount + (Number(x[amount]) || 0)) * 100) / 100; if (x.claim_id) r.claims.add(x.claim_id);
    m.set(k, r);
  }
  return [...m.values()].map((r) => ({ ...r, claims: r.claims.size })).sort((a, b) => b.amount - a.amount || b.count - a.count);
}

/** First `limit` items plus how many were left out. */
export const page = (items, limit = 100) => ({ items: items.slice(0, limit), ...(items.length > limit ? { items_truncated: items.length - limit } : {}) });
