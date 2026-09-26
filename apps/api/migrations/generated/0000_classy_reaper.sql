CREATE TABLE `recipe_dietary` (
	`recipe_id` text NOT NULL,
	`dietary` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `dietary`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredients` (
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`item` text NOT NULL,
	`quantity` real,
	`unit` text,
	`prep` text,
	PRIMARY KEY(`recipe_id`, `position`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recipe_ingredients_position_check" CHECK("recipe_ingredients"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE `recipe_meal_types` (
	`recipe_id` text NOT NULL,
	`meal_type` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `meal_type`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipe_method_steps` (
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`instruction` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `position`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recipe_method_steps_position_check" CHECK("recipe_method_steps"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE `recipe_tags` (
	`recipe_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `tag`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`cuisine` text NOT NULL,
	`serves` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	CONSTRAINT "recipes_source_check" CHECK("recipes"."source" in ('system', 'user')),
	CONSTRAINT "recipes_serves_positive_check" CHECK("recipes"."serves" > 0)
);
