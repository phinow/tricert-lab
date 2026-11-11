// Hosted build of TriCert Lab: the unchanged app, with /api/state answered from the
// artifact's private per-viewer documents instead of the D1 route.
//
// Layout (version 8): one small document per part, all under data/users/<id>/ (a document
// path needs an even number of segments, so each is data/users/<id>/<name>):
//   state          { profile, progress }
//   attempts       { rows }          the latest answer to each question, newest first
//   rec-<key>      { key, value, updated_at }   for plan, srs, mocks, log and usercards
//   doc-<doc key>  one written document (artifact_key, status, evidence_text, reflection, updated_at)
// Load reads the collection once. Each save reads the documents it changes, applies the
// change and writes only those. Version 7.1.1 kept everything in `state`; that document is
// split into the new ones on first load.
import { createRoot } from 'react-dom/client';
import TriCertApp from '@app/tricert-app';

type Row = Record<string, unknown>;
type Snap = { id?: string; exists: boolean; data(): Row | undefined };
type DocRef = { get(): Promise<Snap>; set(data: Row): Promise<void> };
type Collection = { get(): Promise<{ docs: Snap[] }>; doc(id: string): DocRef };
type Store = { doc(path: string): DocRef; collection(path: string): Collection };

declare global {
  interface Window { claude?: { use(name: string): Promise<unknown> } }
}

// Limits, the same as the local copy (lib/tricert-repository.ts). Text over a limit is
// refused with a message, never cut short.
const limits = {
  education: 40, projectsLed: 4000, domainName: 80, displayName: 40, motivation: 140, itemKey: 120,
  questionId: 160, certification: 20, domain: 200, answer: 20, artifactKey: 160,
  work: 20000, explanation: 6000, recordId: 200, record: 200000,
};
// The store refuses a document over 256 KiB.
const documentBytes = 262144;
const patchKeys = ['plan', 'srs'];
const appendKeys = ['mocks', 'log', 'usercards'];

let docs = new Map<string, Row>();
let collection: Collection | null = null;
let ready: Promise<void> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
// Inside claude.ai progress is saved to the page's private store or not at all. Outside it
// (the file opened on its own) the page keeps progress in memory.
const hosted = () => Boolean(window.claude);
// True once saved progress has been read from the store. Nothing is written before that,
// so a failed read can never be followed by a save that wipes stored progress.
let loaded = false;
const unreachable = 'Your saved progress cannot be reached right now, so nothing was changed. Reload the page to try again.';

class Refused extends Error {}

const isObject = (value: unknown): value is Row => typeof value === 'object' && value !== null && !Array.isArray(value);
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isObject) : []);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();

// A store segment allows letters, digits and _ - . ~ : @ + only. Anything else in a document
// key, and ~ itself, becomes ~ and two hex digits per byte.
function docName(key: string) {
  const safe = Array.from(new TextEncoder().encode(key), (byte) => {
    const char = String.fromCharCode(byte);
    return /[A-Za-z0-9_\-.:@+]/.test(char) ? char : `~${byte.toString(16).padStart(2, '0')}`;
  }).join('');
  return `doc-${safe}`;
}

function stateView() {
  const main = docs.get('state') ?? {};
  const artifacts = [...docs.entries()]
    .filter(([name]) => name.startsWith('doc-'))
    .map(([, body]) => body)
    .sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')));
  const record = (key: string) => docs.get(`rec-${key}`)?.value;
  const object = (value: unknown) => (isObject(value) ? value : {});
  const srs = object(record('srs'));
  return {
    profile: isObject(main.profile) ? main.profile : null,
    progress: rows(main.progress),
    attempts: rows(docs.get('attempts')?.rows),
    artifacts,
    records: {
      plan: object(record('plan')),
      srs: { ...srs, cards: object(srs.cards), questions: object(srs.questions) },
      mocks: rows(record('mocks')),
      log: rows(record('log')),
      usercards: rows(record('usercards')),
    },
  };
}

function text(value: unknown, max: number, label: string, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Refused(`${label} is ${trimmed.length.toLocaleString('en-US')} characters, over the limit of ${max.toLocaleString('en-US')}. Nothing was saved.`);
  return trimmed;
}
const num = (value: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
const pick = (value: unknown, allowed: string[], fallback: string) => (allowed.includes(String(value)) ? String(value) : fallback);
const date = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : '');
const level = (value: unknown) => pick(value, ['beginner', 'intermediate', 'advanced'], 'beginner');

// patch-record: objects merge to three levels (the record, its fields, their fields);
// deeper values and arrays are replaced whole; null removes a key.
function merge(target: Row, patch: Row, depth = 1): Row {
  const out: Row = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (value === null) delete out[key];
    else if (depth < 3 && isObject(value)) out[key] = merge(isObject(out[key]) ? out[key] : {}, value, depth + 1);
    else out[key] = value;
  }
  return out;
}

// Keeps the latest answer to each question, newest first, with when it was first answered
// and how many times.
function mergeAttempts(...lists: Row[][]): Row[] {
  const byQuestion = new Map<string, Row>();
  for (const row of lists.flat()) {
    const id = String(row.question_id ?? '');
    if (!id) continue;
    const created = String(row.created_at ?? '');
    const first = String(row.first_at ?? created);
    const seen = byQuestion.get(id);
    if (!seen) { byQuestion.set(id, { ...row, first_at: first, tries: Number(row.tries) || 1 }); continue; }
    const newer = created > String(seen.created_at ?? '') ? row : seen;
    byQuestion.set(id, {
      ...newer,
      first_at: first < String(seen.first_at) ? first : seen.first_at,
      tries: Math.max(Number(seen.tries) || 1, Number(row.tries) || 1),
    });
  }
  return [...byQuestion.values()].sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

// Which documents an action changes. Throws Refused for a request that cannot be saved.
function targets(body: Row): string[] {
  switch (body.action) {
    case 'save-profile': case 'save-personal': case 'set-progress': return ['state'];
    case 'record-attempt': return ['attempts'];
    case 'save-artifact': {
      const key = text(body.artifactKey, limits.artifactKey, 'The document key');
      if (!key) throw new Refused('An artifact is required.');
      return [docName(key)];
    }
    case 'patch-record':
      if (!patchKeys.includes(String(body.key))) throw new Refused(`patch-record works on ${patchKeys.join(' or ')}, not "${String(body.key).slice(0, 40)}".`);
      return [`rec-${String(body.key)}`];
    case 'append-record':
      if (!appendKeys.includes(String(body.key))) throw new Refused(`append-record works on ${appendKeys.join(', ')}, not "${String(body.key).slice(0, 40)}".`);
      return [`rec-${String(body.key)}`];
    default:
      throw new Refused('Unsupported study action.');
  }
}

// Applies one action to fresh copies of its documents and returns the new bodies.
function apply(body: Row, current: Map<string, Row>): Map<string, Row> {
  const out = new Map<string, Row>();
  const main = current.get('state') ?? {};
  switch (body.action) {
    case 'save-profile': {
      const domains = Array.isArray(body.cyberDomains) ? body.cyberDomains.slice(0, 8).map((value) => text(value, limits.domainName, 'A security area')) : [];
      out.set('state', {
        ...main,
        profile: {
          id: 'primary',
          education: text(body.education, limits.education, 'Education', 'secondary') || 'secondary',
          projects_led: text(body.projectsLed, limits.projectsLed, 'Projects led'),
          pm_months: num(body.pmMonths, 0, 240),
          pm_training_hours: num(body.pmTrainingHours, 0, 500),
          pm_training_complete: body.pmTrainingComplete === true ? 1 : 0,
          cyber_months: num(body.cyberMonths, 0, 240),
          cyber_domains: JSON.stringify(domains),
          power_bi_level: level(body.powerBiLevel),
          power_query_level: level(body.powerQueryLevel),
          dax_level: level(body.daxLevel),
          sql_level: level(body.sqlLevel),
          itil_level: level(body.itilLevel),
          weekly_hours: num(body.weeklyHours, 1, 60),
          pmp_target: date(body.pmpTarget),
          pl300_target: date(body.pl300Target),
          cissp_target: date(body.cisspTarget),
          itil_target: date(body.itilTarget),
          display_name: text(body.displayName, limits.displayName, 'Your name'),
          motivation: text(body.motivation, limits.motivation, 'Your reason'),
          updated_at: now(),
        },
        progress: rows(main.progress),
      });
      break;
    }
    case 'save-personal':
      if (!isObject(main.profile)) throw new Refused('Set up your plan before personalising it.');
      out.set('state', { ...main, profile: { ...main.profile, display_name: text(body.displayName, limits.displayName, 'Your name'), motivation: text(body.motivation, limits.motivation, 'Your reason'), updated_at: now() } });
      break;
    case 'set-progress': {
      const key = text(body.itemKey, limits.itemKey, 'The item key');
      if (!key) throw new Refused('A curriculum item is required.');
      const status = pick(body.status, ['not_started', 'in_progress', 'complete'], 'not_started');
      out.set('state', { ...main, progress: [{ item_key: key, status, updated_at: now() }, ...rows(main.progress).filter((row) => row.item_key !== key)] });
      break;
    }
    case 'record-attempt': {
      const answer = text(body.answer, limits.answer, 'The answer');
      if (!answer) throw new Refused('An answer is required.');
      const attempt = {
        question_id: text(body.questionId, limits.questionId, 'The question id', 'unknown') || 'unknown',
        certification: text(body.certification, limits.certification, 'The exam', 'intersection') || 'intersection',
        domain: text(body.domain, limits.domain, 'The area', 'integrated practice') || 'integrated practice',
        answer,
        correct: body.correct === true ? 1 : 0,
        confidence: pick(body.confidence, ['low', 'medium', 'high'], 'medium'),
        created_at: now(),
      };
      const doc = current.get('attempts') ?? {};
      const before = rows(doc.rows).find((row) => row.question_id === attempt.question_id);
      const counted = { ...attempt, first_at: before ? String(before.first_at ?? before.created_at ?? attempt.created_at) : attempt.created_at, tries: before ? (Number(before.tries) || 1) + 1 : 1 };
      out.set('attempts', { ...doc, rows: mergeAttempts([counted], rows(doc.rows)) });
      break;
    }
    case 'save-artifact': {
      const key = text(body.artifactKey, limits.artifactKey, 'The document key');
      out.set(docName(key), {
        artifact_key: key,
        status: pick(body.status, ['draft', 'review', 'complete'], 'draft'),
        evidence_text: text(body.evidenceText, limits.work, 'Your work'),
        reflection: text(body.reflection, limits.explanation, 'Your explanation'),
        updated_at: now(),
      });
      break;
    }
    case 'patch-record': case 'append-record': {
      const key = String(body.key);
      const name = `rec-${key}`;
      const stored = current.get(name)?.value;
      let value: unknown;
      if (body.action === 'patch-record') {
        if (!isObject(body.patch)) throw new Refused('patch-record needs a patch that is an object.');
        value = merge(isObject(stored) ? stored : {}, body.patch);
      } else {
        const item = body.item;
        if (!isObject(item)) throw new Refused('append-record needs an item that is an object.');
        if (typeof item.id !== 'string' || !item.id || item.id.length > limits.recordId) throw new Refused(`append-record needs an item with an id of 1 to ${limits.recordId} characters.`);
        const list = rows(stored);
        const at = list.findIndex((row) => row.id === item.id);
        if (at >= 0) list[at] = item; else list.push(item);
        value = list;
      }
      const size = JSON.stringify(value).length;
      if (size > limits.record) throw new Refused(`The ${key} record would be ${size.toLocaleString('en-US')} characters, over the limit of ${limits.record.toLocaleString('en-US')}. Nothing was saved.`);
      out.set(name, { key, value, updated_at: now() });
      break;
    }
    default:
      throw new Refused('Unsupported study action.');
  }
  // The store refuses a document over 256 KiB; refuse it here first so nothing is half written.
  for (const [name, doc] of out) {
    const bytes = new TextEncoder().encode(JSON.stringify(doc)).length;
    if (bytes > documentBytes) {
      throw new Refused(`This change would make a saved document ${Math.ceil(bytes / 1024)} KB, over the store's limit of 256 KB (${name}). Nothing was saved.`);
    }
  }
  return out;
}

async function read(names: string[]) {
  const coll = collection!;
  const snaps = await Promise.all(names.map((name) => coll.doc(name).get()));
  const current = new Map<string, Row>();
  names.forEach((name, index) => {
    const snap = snaps[index];
    const data = snap.exists ? snap.data() : undefined;
    if (data) current.set(name, clone(data));
  });
  return current;
}

// Version 7.1.1 kept attempts and artifacts inside `state`. Split them out. Every document is
// read again before it is written, the new documents are written first and `state` last, so
// an interruption leaves the old document whole and the next load finishes the job.
async function migrate() {
  const loadedState = docs.get('state');
  if (!loadedState || (!Array.isArray(loadedState.attempts) && !Array.isArray(loadedState.artifacts))) return;
  const coll = collection!;
  const first = await read(['state', 'attempts']);
  const old = first.get('state');
  if (!old || (!Array.isArray(old.attempts) && !Array.isArray(old.artifacts))) return;
  const writes = new Map<string, Row>();
  const oldAttempts = rows(old.attempts);
  if (oldAttempts.length) {
    const doc = first.get('attempts') ?? {};
    writes.set('attempts', { ...doc, rows: mergeAttempts(rows(doc.rows), oldAttempts) });
  }
  const oldArtifacts = rows(old.artifacts).filter((row) => typeof row.artifact_key === 'string' && row.artifact_key);
  const names = oldArtifacts.map((row) => docName(String(row.artifact_key)));
  const existing = await read(names);
  oldArtifacts.forEach((row, index) => {
    const have = existing.get(names[index]);
    if (have && String(have.updated_at ?? '') >= String(row.updated_at ?? '')) return;
    writes.set(names[index], { ...row });
  });
  for (const [name, doc] of writes) {
    if (new TextEncoder().encode(JSON.stringify(doc)).length > documentBytes) throw new Error(`${name} is over the store's limit`);
  }
  for (const [name, doc] of writes) await coll.doc(name).set(doc);
  const { attempts: _attempts, artifacts: _artifacts, ...rest } = old;
  void _attempts; void _artifacts;
  const main = { ...rest, profile: isObject(old.profile) ? old.profile : null, progress: rows(old.progress) };
  await coll.doc('state').set(main);
  for (const [name, doc] of writes) docs.set(name, doc);
  docs.set('state', main);
}

async function connect() {
  const claude = window.claude;
  if (!claude) return;
  const [db, user] = (await Promise.all([claude.use('db'), claude.use('user')])) as [
    Store | null,
    { id(): Promise<string | null> } | null,
  ];
  const id = user ? await user.id() : null;
  if (!db || !id) throw new Error('The private store is not available.');
  // data/users/<id> is the viewer's own collection; each document in it has 4 segments.
  collection = db.collection(`data/users/${id}`);
  const snap = await collection.get();
  const found = new Map<string, Row>();
  for (const doc of snap.docs) {
    const data = doc.exists ? doc.data() : undefined;
    if (doc.id && data) found.set(doc.id, clone(data));
  }
  docs = found;
  await migrate();
  loaded = true;
}

// One save at a time. Each save reads the documents it changes from the store, so a second
// device or an older tab cannot write its stale copy over newer progress, and writes only those.
function save(body: Row): Promise<Response> {
  const run = writeChain.then(async () => {
    let names: string[];
    try { names = targets(body); } catch (error) { return refused(error); }
    let current: Map<string, Row>;
    if (collection) {
      try { current = await read(names); } catch { return json({ error: unreachable }, 503); }
      for (const name of names) {
        const fresh = current.get(name);
        if (fresh) docs.set(name, fresh); else docs.delete(name);
      }
    } else {
      current = new Map(names.flatMap((name) => (docs.has(name) ? [[name, clone(docs.get(name)!)] as [string, Row]] : [])));
    }
    let changes: Map<string, Row>;
    try { changes = apply(body, current); } catch (error) { return refused(error); }
    if (collection) {
      for (const [name, doc] of changes) {
        try {
          await collection.doc(name).set(doc);
        } catch {
          return json({ error: 'Your change could not be saved. Check your connection and try again.' }, 500);
        }
        docs.set(name, doc);
      }
    } else {
      for (const [name, doc] of changes) docs.set(name, doc);
    }
    return json(stateView());
  }).catch(() => json({ error: unreachable }, 503));
  writeChain = run;
  return run;
}

function refused(error: unknown) {
  if (error instanceof Refused) return json({ error: error.message }, 400);
  throw error;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith('/api/state')) return realFetch(input, init);
  // A failed connection is forgotten, so the next request tries again.
  ready ??= connect().catch(() => { ready = null; });
  await ready;
  if (hosted() && !loaded) return json({ error: unreachable }, 503);
  if (!init || init.method !== 'PUT') return json(stateView());
  let body: Row;
  try { body = JSON.parse(String(init.body)) as Row; } catch { return json({ error: 'The request could not be read.' }, 400); }
  return save(body);
};

// Downloads: the frame cannot start downloads itself, so hand files to the viewer's save prompt.
const allowed = /\.(csv|md|txt|json|png|pdf|zip|html)$/i;
URL.revokeObjectURL = ((original) => (href: string) => { window.setTimeout(() => original.call(URL, href), 30000); })(URL.revokeObjectURL);
async function offer(href: string, filename: string) {
  const downloads = (await window.claude?.use('downloads')) as { save(req: { filename: string; data: Blob }): Promise<unknown> } | null;
  if (!downloads) return;
  const blob = await (await realFetch(href)).blob();
  const name = allowed.test(filename) ? filename : `${filename}.txt`;
  try { await downloads.save({ filename: name, data: blob }); } catch { /* declined or unavailable */ }
}
function nameFor(anchor: HTMLAnchorElement) {
  return anchor.getAttribute('download') || anchor.getAttribute('href')?.split('/').pop() || 'download.txt';
}
const originalClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
  if (this.hasAttribute('download')) { void offer(this.href, nameFor(this)); return; }
  originalClick.call(this);
};
document.addEventListener('click', (event) => {
  const anchor = (event.target as Element | null)?.closest?.('a[download]') as HTMLAnchorElement | null;
  if (!anchor) return;
  event.preventDefault();
  void offer(anchor.href, nameFor(anchor));
}, true);

createRoot(document.getElementById('root')!).render(<TriCertApp />);
