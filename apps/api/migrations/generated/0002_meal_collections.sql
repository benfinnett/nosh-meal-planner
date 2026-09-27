-- Drizzle does not emit changes to existing SQLite CHECK constraints.
-- Preserve child preferences explicitly while rebuilding their parent.
CREATE TEMP TABLE `saved_household_dietary` AS SELECT * FROM `household_dietary_preferences`;
--> statement-breakpoint
CREATE TABLE `new_household_settings` (
  `id` integer PRIMARY KEY NOT NULL,
  `household_size` integer NOT NULL,
  `location` text NOT NULL,
  CONSTRAINT "household_singleton" CHECK("id" = 1),
  CONSTRAINT "household_size_valid" CHECK("household_size" > 0 AND "household_size" <= 9007199254740991),
  CONSTRAINT "household_location_valid" CHECK("location" IN ('england', 'wales', 'northern-ireland', 'scotland', 'outside-uk', 'unspecified'))
);
--> statement-breakpoint
INSERT INTO `new_household_settings` SELECT * FROM `household_settings`;
--> statement-breakpoint
DROP TABLE `household_settings`;
--> statement-breakpoint
ALTER TABLE `new_household_settings` RENAME TO `household_settings`;
--> statement-breakpoint
INSERT OR IGNORE INTO `household_dietary_preferences` SELECT * FROM `saved_household_dietary`;
--> statement-breakpoint
DROP TABLE `saved_household_dietary`;
--> statement-breakpoint
CREATE TABLE `planner_collections` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`status` text,
	`week_start` text,
	`name` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`shopping` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "planner_kind_valid" CHECK(("planner_collections"."kind" = 'week' AND "planner_collections"."status" IN ('active','archived') AND "planner_collections"."week_start" IS NOT NULL AND "planner_collections"."name" IS NULL) OR ("planner_collections"."kind" = 'template' AND "planner_collections"."status" IS NULL AND "planner_collections"."week_start" IS NULL AND "planner_collections"."name" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `planner_one_active` ON `planner_collections` (`status`) WHERE "planner_collections"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `planner_week_date` ON `planner_collections` (`week_start`);--> statement-breakpoint
CREATE UNIQUE INDEX `planner_template_name` ON `planner_collections` (lower("name")) WHERE "planner_collections"."kind" = 'template';--> statement-breakpoint
CREATE TABLE `planner_meals` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`source_recipe_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`servings` integer NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `planner_collections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "planner_servings_valid" CHECK("planner_meals"."servings" > 0 AND "planner_meals"."servings" <= 9007199254740991)
);
--> statement-breakpoint
CREATE INDEX `planner_meals_owner` ON `planner_meals` (`collection_id`);--> statement-breakpoint
CREATE TABLE `planner_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`request` text NOT NULL,
	`response` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `planner_previews` (
	`token` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`revision` integer NOT NULL,
	`inputs` text NOT NULL,
	`expires_at` text NOT NULL,
	`result` text NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `planner_collections`(`id`) ON UPDATE no action ON DELETE cascade
);
