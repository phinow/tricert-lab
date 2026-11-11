import { env } from 'cloudflare:workers';

export type LearnerProfile = {
  id: string;
  education: string;
  projects_led: string;
  pm_months: number;
  pm_training_hours: number;
  pm_training_complete: number;
  cyber_months: number;
  cyber_domains: string;
  power_bi_level: string;
  power_query_level: string;
  dax_level: string;
  sql_level: string;
  itil_level: string;
  weekly_hours: number;
  pmp_target: string;
  pl300_target: string;
  cissp_target: string;
  itil_target: string;
  display_name: string;
  motivation: string;
  updated_at: string;
};

const learnerId = 'primary';

/* Size limits, the same in the hosted copy (tools/harness/entry-artifact.tsx). A value over
   its limit is refused with a message; nothing is cut short without telling the caller. */
export const limits = {
  education: 40,
  projectsLed: 4000,
  domainName: 80,
  displayName: 40,
  motivation: 140,
  itemKey: 120,
  questionId: 160,
  certification: 20,
  domain: 200,
  answer: 20,
  artifactKey: 160,
  work: 20000,
  explanation: 6000,
  recordId: 200,
  record: 200000,
} as const;

export type RecordKey = 'plan' | 'srs' | 'mocks' | 'log' | 'usercards';
export const patchKeys = ['plan', 'srs'] as const;
export const appendKeys = ['mocks', 'log', 'usercards'] as const;
type Json = Record<string, unknown>;

function db() {
  if (!env.DB) throw new Error('Study database is unavailable.');
  return env.DB;
}

export async function ensureStudySchema() {
  const d1 = db();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS learner_profiles (
      id TEXT PRIMARY KEY,
      education TEXT NOT NULL,
      projects_led TEXT NOT NULL DEFAULT '',
      pm_months INTEGER NOT NULL DEFAULT 0,
      pm_training_hours INTEGER NOT NULL DEFAULT 0,
      pm_training_complete INTEGER NOT NULL DEFAULT 0,
      cyber_months INTEGER NOT NULL DEFAULT 0,
      cyber_domains TEXT NOT NULL DEFAULT '[]',
      power_bi_level TEXT NOT NULL DEFAULT 'beginner',
      power_query_level TEXT NOT NULL DEFAULT 'beginner',
      dax_level TEXT NOT NULL DEFAULT 'beginner',
      sql_level TEXT NOT NULL DEFAULT 'beginner',
      itil_level TEXT NOT NULL DEFAULT 'beginner',
      weekly_hours INTEGER NOT NULL DEFAULT 18,
      pmp_target TEXT NOT NULL DEFAULT '',
      pl300_target TEXT NOT NULL DEFAULT '',
      cissp_target TEXT NOT NULL DEFAULT '',
      itil_target TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL DEFAULT '',
      motivation TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS progress_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_started',
      updated_at TEXT NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      certification TEXT NOT NULL,
      domain TEXT NOT NULL,
      answer TEXT NOT NULL,
      correct INTEGER NOT NULL,
      confidence TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS artifact_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      artifact_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      evidence_text TEXT NOT NULL DEFAULT '',
      reflection TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS study_records (
      learner_id TEXT NOT NULL,
      record_key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      learner_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      object_key TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_learner_item ON progress_items(learner_id, item_key)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_progress_learner_status ON progress_items(learner_id, status)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_learner_cert ON quiz_attempts(learner_id, certification)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_learner_domain ON quiz_attempts(learner_id, domain)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_attempts_learner_question ON quiz_attempts(learner_id, question_id)'),
    d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_records_learner_key ON study_records(learner_id, record_key)'),
    d1.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_learner_key ON artifact_evidence(learner_id, artifact_key)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_artifacts_learner_status ON artifact_evidence(learner_id, status)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_activity_learner_created ON activity_log(learner_id, created_at)'),
  ]);
  const profileColumns = await d1.prepare('PRAGMA table_info(learner_profiles)').all<{ name: string }>();
  const names = new Set(profileColumns.results.map((column) => column.name));
  if (!names.has('projects_led')) await d1.prepare("ALTER TABLE learner_profiles ADD COLUMN projects_led TEXT NOT NULL DEFAULT ''").run();
  if (!names.has('pm_training_complete')) await d1.prepare('ALTER TABLE learner_profiles ADD COLUMN pm_training_complete INTEGER NOT NULL DEFAULT 0').run();
  if (!names.has('power_query_level')) await d1.prepare("ALTER TABLE learner_profiles ADD COLUMN power_query_level TEXT NOT NULL DEFAULT 'beginner'").run();
  if (!names.has('itil_level')) await d1.prepare("ALTER TABLE learner_profiles ADD COLUMN itil_level TEXT NOT NULL DEFAULT 'beginner'").run();
  if (!names.has('itil_target')) await d1.prepare("ALTER TABLE learner_profiles ADD COLUMN itil_target TEXT NOT NULL DEFAULT ''").run();
  if (!names.has('display_name')) await d1.prepare("ALTER TABLE learner_profiles ADD COLUMN display_name TEXT NOT NULL DEFAULT ''").run();
  if (!names.has('motivation')) await d1.prepare("ALTER TABLE learner_profiles ADD COLUMN motivation TEXT NOT NULL DEFAULT ''").run();
  await d1.prepare('PRAGMA optimize').run();
}

export async function getStudyState() {
  await ensureStudySchema();
  const d1 = db();
  const [profile, progress, attempts, artifacts, records] = await Promise.all([
    d1.prepare('SELECT * FROM learner_profiles WHERE id = ?').bind(learnerId).first<LearnerProfile>(),
    d1.prepare('SELECT item_key, status, updated_at FROM progress_items WHERE learner_id = ? ORDER BY updated_at DESC').bind(learnerId).all(),
    // The latest answer to each question, newest first, with no row limit. first_at is the
    // time of the first answer to that question and tries counts every answer to it.
    d1.prepare(`SELECT a.question_id, a.certification, a.domain, a.answer, a.correct, a.confidence,
        a.created_at, m.first_at, m.tries
      FROM quiz_attempts a
      JOIN (SELECT MAX(id) AS id, MIN(created_at) AS first_at, COUNT(*) AS tries
        FROM quiz_attempts WHERE learner_id = ? GROUP BY question_id) m ON a.id = m.id
      ORDER BY a.id DESC`).bind(learnerId).all(),
    d1.prepare('SELECT artifact_key, status, evidence_text, reflection, updated_at FROM artifact_evidence WHERE learner_id = ? ORDER BY updated_at DESC').bind(learnerId).all(),
    d1.prepare('SELECT record_key, value FROM study_records WHERE learner_id = ?').bind(learnerId).all<{ record_key: string; value: string }>(),
  ]);
  const stored: Partial<Record<RecordKey, unknown>> = {};
  for (const row of records.results) {
    try { stored[row.record_key as RecordKey] = JSON.parse(row.value); } catch { /* an unreadable value reads as empty */ }
  }
  return {
    profile,
    progress: progress.results,
    attempts: attempts.results,
    artifacts: artifacts.results,
    records: withRecordDefaults(stored),
  };
}

/* The records with an empty value for each one never written. */
export function withRecordDefaults(stored: Partial<Record<RecordKey, unknown>>) {
  const object = (value: unknown) => (isObject(value) ? value : {});
  const list = (value: unknown) => (Array.isArray(value) ? value.filter(isObject) : []);
  const srs = object(stored.srs);
  return {
    plan: object(stored.plan),
    srs: { ...srs, cards: object(srs.cards), questions: object(srs.questions) },
    mocks: list(stored.mocks),
    log: list(stored.log),
    usercards: list(stored.usercards),
  };
}

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* Deep merge for patch-record: objects merge to three levels (the record, its fields, and
   their fields; for example srs, then cards, then one card). Deeper values and arrays are
   replaced whole. null removes a key. */
export function mergeRecord(target: Json, patch: Json, level = 1): Json {
  const out: Json = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (value === null) delete out[key];
    else if (level < 3 && isObject(value)) out[key] = mergeRecord(isObject(out[key]) ? out[key] : {}, value, level + 1);
    else out[key] = value;
  }
  return out;
}

/* append-record: adds the item, or replaces the item that has the same id in place. */
export function appendRecordItem(list: unknown, item: Json): Json[] {
  const rows = Array.isArray(list) ? list.filter(isObject) : [];
  const at = rows.findIndex((row) => row.id === item.id);
  if (at >= 0) rows[at] = item;
  else rows.push(item);
  return rows;
}

/* Checks a patch-record or append-record request and returns the change to make. */
export function recordChange(input: Record<string, unknown>): { key: RecordKey; change: (current: unknown) => unknown } {
  if (input.action === 'patch-record') {
    const key = String(input.key);
    if (!(patchKeys as readonly string[]).includes(key)) throw new Error(`patch-record works on ${patchKeys.join(' or ')}, not "${key.slice(0, 40)}".`);
    if (!isObject(input.patch)) throw new Error('patch-record needs a patch that is an object.');
    const patch = input.patch;
    return { key: key as RecordKey, change: (current) => mergeRecord(isObject(current) ? current : {}, patch) };
  }
  const key = String(input.key);
  if (!(appendKeys as readonly string[]).includes(key)) throw new Error(`append-record works on ${appendKeys.join(', ')}, not "${key.slice(0, 40)}".`);
  const item = input.item;
  if (!isObject(item)) throw new Error('append-record needs an item that is an object.');
  if (typeof item.id !== 'string' || !item.id || item.id.length > limits.recordId) throw new Error(`append-record needs an item with an id of 1 to ${limits.recordId} characters.`);
  return { key: key as RecordKey, change: (current) => appendRecordItem(current, item) };
}

export function recordText(key: RecordKey, value: unknown) {
  const text = JSON.stringify(value);
  if (text.length > limits.record) {
    throw new Error(`The ${key} record would be ${text.length.toLocaleString('en-US')} characters, over the limit of ${limits.record.toLocaleString('en-US')}. Nothing was saved.`);
  }
  return text;
}

/* patch-record and append-record. Read, change, then write only if the stored value is still
   the one that was read; otherwise read again (another save came first). */
export async function changeRecord(input: Record<string, unknown>) {
  await ensureStudySchema();
  const { key, change } = recordChange(input);
  const d1 = db();
  for (let tries = 0; tries < 5; tries += 1) {
    const row = await d1.prepare('SELECT value FROM study_records WHERE learner_id = ? AND record_key = ?').bind(learnerId, key).first<{ value: string }>();
    let current: unknown;
    if (row) {
      try { current = JSON.parse(row.value); } catch { throw new Error(`The stored ${key} record cannot be read, so nothing was changed.`); }
    }
    const text = recordText(key, change(current));
    const now = new Date().toISOString();
    const result = row
      ? await d1.prepare('UPDATE study_records SET value = ?, updated_at = ? WHERE learner_id = ? AND record_key = ? AND value = ?')
        .bind(text, now, learnerId, key, row.value).run()
      : await d1.prepare('INSERT INTO study_records (learner_id, record_key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(learner_id, record_key) DO NOTHING')
        .bind(learnerId, key, text, now).run();
    if (result.meta.changes) {
      await logEvent(`record.${String(input.action)}`, key);
      return;
    }
  }
  throw new Error('Another save changed this record at the same moment. Try again.');
}

export async function saveProfile(input: Record<string, unknown>) {
  await ensureStudySchema();
  const now = new Date().toISOString();
  const education = boundedString(input.education, limits.education, 'secondary', 'Education') || 'secondary';
  const domains = Array.isArray(input.cyberDomains)
    ? input.cyberDomains.slice(0, 8).map((value) => boundedString(value, limits.domainName, '', 'A security area'))
    : [];
  await db()
    .prepare(`INSERT INTO learner_profiles (
      id, education, projects_led, pm_months, pm_training_hours, pm_training_complete,
      cyber_months, cyber_domains, power_bi_level, power_query_level, dax_level,
      sql_level, itil_level, weekly_hours, pmp_target, pl300_target, cissp_target,
      itil_target, display_name, motivation, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      education = excluded.education,
      projects_led = excluded.projects_led,
      pm_months = excluded.pm_months,
      pm_training_hours = excluded.pm_training_hours,
      pm_training_complete = excluded.pm_training_complete,
      cyber_months = excluded.cyber_months,
      cyber_domains = excluded.cyber_domains,
      power_bi_level = excluded.power_bi_level,
      power_query_level = excluded.power_query_level,
      dax_level = excluded.dax_level,
      sql_level = excluded.sql_level,
      itil_level = excluded.itil_level,
      weekly_hours = excluded.weekly_hours,
      pmp_target = excluded.pmp_target,
      pl300_target = excluded.pl300_target,
      cissp_target = excluded.cissp_target,
      itil_target = excluded.itil_target,
      display_name = excluded.display_name,
      motivation = excluded.motivation,
      updated_at = excluded.updated_at`)
    .bind(
      learnerId,
      education,
      boundedString(input.projectsLed, limits.projectsLed, '', 'Projects led'),
      boundedInt(input.pmMonths, 0, 240),
      boundedInt(input.pmTrainingHours, 0, 500),
      input.pmTrainingComplete === true ? 1 : 0,
      boundedInt(input.cyberMonths, 0, 240),
      JSON.stringify(domains),
      skillLevel(input.powerBiLevel),
      skillLevel(input.powerQueryLevel),
      skillLevel(input.daxLevel),
      skillLevel(input.sqlLevel),
      skillLevel(input.itilLevel),
      boundedInt(input.weeklyHours, 1, 60),
      dateString(input.pmpTarget),
      dateString(input.pl300Target),
      dateString(input.cisspTarget),
      dateString(input.itilTarget),
      boundedString(input.displayName, limits.displayName, '', 'Your name'),
      boundedString(input.motivation, limits.motivation, '', 'Your reason'),
      now,
    )
    .run();
  await logEvent('profile.saved', 'profile');
}

/* The learner's name and their reason for studying, shown on Today. */
export async function savePersonal(input: Record<string, unknown>) {
  await ensureStudySchema();
  const result = await db()
    .prepare('UPDATE learner_profiles SET display_name = ?, motivation = ?, updated_at = ? WHERE id = ?')
    .bind(boundedString(input.displayName, limits.displayName, '', 'Your name'), boundedString(input.motivation, limits.motivation, '', 'Your reason'), new Date().toISOString(), learnerId)
    .run();
  if (!result.meta.changes) throw new Error('Set up your plan before personalising it.');
  await logEvent('profile.personal', 'profile');
}

export async function setProgress(input: Record<string, unknown>) {
  await ensureStudySchema();
  const itemKey = boundedString(input.itemKey, limits.itemKey, '', 'The item key');
  const status = ['not_started', 'in_progress', 'complete'].includes(String(input.status))
    ? String(input.status)
    : 'not_started';
  if (!itemKey) throw new Error('A curriculum item is required.');
  await db()
    .prepare(`INSERT INTO progress_items (learner_id, item_key, status, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(learner_id, item_key) DO UPDATE SET
        status = excluded.status, updated_at = excluded.updated_at`)
    .bind(learnerId, itemKey, status, new Date().toISOString())
    .run();
  await logEvent(`progress.${status}`, itemKey);
}

export async function recordAttempt(input: Record<string, unknown>) {
  await ensureStudySchema();
  const answer = boundedString(input.answer, limits.answer, '', 'The answer');
  if (!answer) throw new Error('An answer is required.');
  const questionId = boundedString(input.questionId, limits.questionId, 'unknown', 'The question id') || 'unknown';
  await db()
    .prepare(`INSERT INTO quiz_attempts (
      learner_id, question_id, certification, domain, answer, correct,
      confidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      learnerId,
      questionId,
      boundedString(input.certification, limits.certification, 'intersection', 'The exam') || 'intersection',
      boundedString(input.domain, limits.domain, 'integrated practice', 'The area') || 'integrated practice',
      answer,
      input.correct === true ? 1 : 0,
      ['low', 'medium', 'high'].includes(String(input.confidence))
        ? String(input.confidence)
        : 'medium',
      new Date().toISOString(),
    )
    .run();
  await logEvent(input.correct === true ? 'attempt.correct' : 'attempt.incorrect', questionId);
}

export async function saveArtifact(input: Record<string, unknown>) {
  await ensureStudySchema();
  const artifactKey = boundedString(input.artifactKey, limits.artifactKey, '', 'The document key');
  if (!artifactKey) throw new Error('An artifact is required.');
  const status = ['draft', 'review', 'complete'].includes(String(input.status))
    ? String(input.status)
    : 'draft';
  await db()
    .prepare(`INSERT INTO artifact_evidence (
      learner_id, artifact_key, status, evidence_text, reflection, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(learner_id, artifact_key) DO UPDATE SET
      status = excluded.status,
      evidence_text = excluded.evidence_text,
      reflection = excluded.reflection,
      updated_at = excluded.updated_at`)
    .bind(
      learnerId,
      artifactKey,
      status,
      boundedString(input.evidenceText, limits.work, '', 'Your work'),
      boundedString(input.reflection, limits.explanation, '', 'Your explanation'),
      new Date().toISOString(),
    )
    .run();
  await logEvent(`artifact.${status}`, artifactKey);
}

async function logEvent(eventType: string, objectKey: string) {
  await db()
    .prepare('INSERT INTO activity_log (learner_id, event_type, object_key, created_at) VALUES (?, ?, ?, ?)')
    .bind(learnerId, eventType, objectKey, new Date().toISOString())
    .run();
}

/* A trimmed string, or the fallback when the value is not a string. Over the limit it is
   refused with a message naming the field, never cut short. */
function boundedString(value: unknown, max: number, fallback: string, label: string) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim();
  if (text.length > max) {
    throw new Error(`${label} is ${text.length.toLocaleString('en-US')} characters, over the limit of ${max.toLocaleString('en-US')}. Nothing was saved.`);
  }
  return text;
}

function boundedInt(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function skillLevel(value: unknown) {
  return ['beginner', 'intermediate', 'advanced'].includes(String(value))
    ? String(value)
    : 'beginner';
}

function dateString(value: unknown) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}
