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
  const [profile, progress, attempts, artifacts] = await Promise.all([
    d1.prepare('SELECT * FROM learner_profiles WHERE id = ?').bind(learnerId).first<LearnerProfile>(),
    d1.prepare('SELECT item_key, status, updated_at FROM progress_items WHERE learner_id = ? ORDER BY updated_at DESC').bind(learnerId).all(),
    d1.prepare('SELECT question_id, certification, domain, answer, correct, confidence, created_at FROM quiz_attempts WHERE learner_id = ? ORDER BY id DESC LIMIT 100').bind(learnerId).all(),
    d1.prepare('SELECT artifact_key, status, evidence_text, reflection, updated_at FROM artifact_evidence WHERE learner_id = ? ORDER BY updated_at DESC').bind(learnerId).all(),
  ]);
  return {
    profile,
    progress: progress.results,
    attempts: attempts.results,
    artifacts: artifacts.results,
  };
}

export async function saveProfile(input: Record<string, unknown>) {
  await ensureStudySchema();
  const now = new Date().toISOString();
  const education = boundedString(input.education, 60, 'secondary');
  const domains = Array.isArray(input.cyberDomains)
    ? input.cyberDomains.slice(0, 8).map((value) => boundedString(value, 80, ''))
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
      boundedString(input.projectsLed, 1200, ''),
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
      boundedString(input.displayName, 40, ''),
      boundedString(input.motivation, 140, ''),
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
    .bind(boundedString(input.displayName, 40, ''), boundedString(input.motivation, 140, ''), new Date().toISOString(), learnerId)
    .run();
  if (!result.meta.changes) throw new Error('Set up your plan before personalising it.');
  await logEvent('profile.personal', 'profile');
}

export async function setProgress(input: Record<string, unknown>) {
  await ensureStudySchema();
  const itemKey = boundedString(input.itemKey, 100, '');
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
  const answer = boundedString(input.answer, 20, '');
  if (!answer) throw new Error('An answer is required.');
  await db()
    .prepare(`INSERT INTO quiz_attempts (
      learner_id, question_id, certification, domain, answer, correct,
      confidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      learnerId,
      boundedString(input.questionId, 80, 'unknown'),
      boundedString(input.certification, 30, 'intersection'),
      boundedString(input.domain, 120, 'integrated practice'),
      answer,
      input.correct === true ? 1 : 0,
      ['low', 'medium', 'high'].includes(String(input.confidence))
        ? String(input.confidence)
        : 'medium',
      new Date().toISOString(),
    )
    .run();
  await logEvent(input.correct === true ? 'attempt.correct' : 'attempt.incorrect', boundedString(input.questionId, 80, 'unknown'));
}

export async function saveArtifact(input: Record<string, unknown>) {
  await ensureStudySchema();
  const artifactKey = boundedString(input.artifactKey, 100, '');
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
      boundedString(input.evidenceText, 8000, ''),
      boundedString(input.reflection, 2000, ''),
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

function boundedString(value: unknown, max: number, fallback: string) {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, max);
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
  const candidate = boundedString(value, 10, '');
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}
