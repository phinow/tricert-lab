CREATE TABLE `study_records` (
	`learner_id` text NOT NULL,
	`record_key` text NOT NULL,
	`value` text DEFAULT '{}' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_records_learner_key` ON `study_records` (`learner_id`,`record_key`);--> statement-breakpoint
CREATE INDEX `idx_attempts_learner_question` ON `quiz_attempts` (`learner_id`,`question_id`);