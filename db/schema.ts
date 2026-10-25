import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const learnerProfiles = sqliteTable('learner_profiles', {
  id: text('id').primaryKey(),
  education: text('education').notNull(),
  projectsLed: text('projects_led').notNull().default(''),
  pmMonths: integer('pm_months').notNull().default(0),
  pmTrainingHours: integer('pm_training_hours').notNull().default(0),
  pmTrainingComplete: integer('pm_training_complete', { mode: 'boolean' }).notNull().default(false),
  cyberMonths: integer('cyber_months').notNull().default(0),
  cyberDomains: text('cyber_domains').notNull().default('[]'),
  powerBiLevel: text('power_bi_level').notNull().default('beginner'),
  powerQueryLevel: text('power_query_level').notNull().default('beginner'),
  daxLevel: text('dax_level').notNull().default('beginner'),
  sqlLevel: text('sql_level').notNull().default('beginner'),
  itilLevel: text('itil_level').notNull().default('beginner'),
  weeklyHours: integer('weekly_hours').notNull().default(18),
  pmpTarget: text('pmp_target').notNull().default(''),
  pl300Target: text('pl300_target').notNull().default(''),
  cisspTarget: text('cissp_target').notNull().default(''),
  itilTarget: text('itil_target').notNull().default(''),
  displayName: text('display_name').notNull().default(''),
  motivation: text('motivation').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
});

export const progressItems = sqliteTable(
  'progress_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    learnerId: text('learner_id').notNull(),
    itemKey: text('item_key').notNull(),
    status: text('status').notNull().default('not_started'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_progress_learner_item').on(table.learnerId, table.itemKey),
    index('idx_progress_learner_status').on(table.learnerId, table.status),
  ],
);

export const quizAttempts = sqliteTable(
  'quiz_attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    learnerId: text('learner_id').notNull(),
    questionId: text('question_id').notNull(),
    certification: text('certification').notNull(),
    domain: text('domain').notNull(),
    answer: text('answer').notNull(),
    correct: integer('correct', { mode: 'boolean' }).notNull(),
    confidence: text('confidence').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_attempts_learner_cert').on(table.learnerId, table.certification),
    index('idx_attempts_learner_domain').on(table.learnerId, table.domain),
  ],
);

export const artifactEvidence = sqliteTable(
  'artifact_evidence',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    learnerId: text('learner_id').notNull(),
    artifactKey: text('artifact_key').notNull(),
    status: text('status').notNull().default('draft'),
    evidenceText: text('evidence_text').notNull().default(''),
    reflection: text('reflection').notNull().default(''),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_artifacts_learner_key').on(table.learnerId, table.artifactKey),
    index('idx_artifacts_learner_status').on(table.learnerId, table.status),
  ],
);

export const activityLog = sqliteTable(
  'activity_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    learnerId: text('learner_id').notNull(),
    eventType: text('event_type').notNull(),
    objectKey: text('object_key').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_activity_learner_created').on(table.learnerId, table.createdAt)],
);
