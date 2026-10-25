CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_id` text NOT NULL,
	`event_type` text NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_learner_created` ON `activity_log` (`learner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `artifact_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_id` text NOT NULL,
	`artifact_key` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`evidence_text` text DEFAULT '' NOT NULL,
	`reflection` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_artifacts_learner_key` ON `artifact_evidence` (`learner_id`,`artifact_key`);--> statement-breakpoint
CREATE INDEX `idx_artifacts_learner_status` ON `artifact_evidence` (`learner_id`,`status`);--> statement-breakpoint
CREATE TABLE `learner_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`education` text NOT NULL,
	`projects_led` text DEFAULT '' NOT NULL,
	`pm_months` integer DEFAULT 0 NOT NULL,
	`pm_training_hours` integer DEFAULT 0 NOT NULL,
	`pm_training_complete` integer DEFAULT false NOT NULL,
	`cyber_months` integer DEFAULT 0 NOT NULL,
	`cyber_domains` text DEFAULT '[]' NOT NULL,
	`power_bi_level` text DEFAULT 'beginner' NOT NULL,
	`power_query_level` text DEFAULT 'beginner' NOT NULL,
	`dax_level` text DEFAULT 'beginner' NOT NULL,
	`sql_level` text DEFAULT 'beginner' NOT NULL,
	`weekly_hours` integer DEFAULT 18 NOT NULL,
	`pmp_target` text DEFAULT '' NOT NULL,
	`pl300_target` text DEFAULT '' NOT NULL,
	`cissp_target` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `progress_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_id` text NOT NULL,
	`item_key` text NOT NULL,
	`status` text DEFAULT 'not_started' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_progress_learner_item` ON `progress_items` (`learner_id`,`item_key`);--> statement-breakpoint
CREATE INDEX `idx_progress_learner_status` ON `progress_items` (`learner_id`,`status`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`learner_id` text NOT NULL,
	`question_id` text NOT NULL,
	`certification` text NOT NULL,
	`domain` text NOT NULL,
	`answer` text NOT NULL,
	`correct` integer NOT NULL,
	`confidence` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_learner_cert` ON `quiz_attempts` (`learner_id`,`certification`);--> statement-breakpoint
CREATE INDEX `idx_attempts_learner_domain` ON `quiz_attempts` (`learner_id`,`domain`);