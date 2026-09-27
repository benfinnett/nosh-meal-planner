CREATE TABLE `household_dietary_preferences` (
	`household_id` integer NOT NULL,
	`preference` text NOT NULL,
	PRIMARY KEY(`household_id`, `preference`),
	FOREIGN KEY (`household_id`) REFERENCES `household_settings`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "household_preference_valid" CHECK("household_dietary_preferences"."preference" IN ('vegetarian', 'vegan', 'dairy-free', 'gluten-free'))
);
--> statement-breakpoint
CREATE TABLE `household_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`household_size` integer NOT NULL,
	`location` text NOT NULL,
	CONSTRAINT "household_singleton" CHECK("household_settings"."id" = 1),
	CONSTRAINT "household_size_valid" CHECK("household_settings"."household_size" > 0 AND "household_settings"."household_size" <= 50),
	CONSTRAINT "household_location_valid" CHECK("household_settings"."location" IN ('england', 'wales', 'northern-ireland', 'scotland', 'outside-uk', 'unspecified'))
);
