import {
  check,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const householdSettings = sqliteTable(
  "household_settings",
  {
    id: integer("id").primaryKey(),
    householdSize: integer("household_size").notNull(),
    location: text("location", {
      enum: [
        "england",
        "wales",
        "northern-ireland",
        "scotland",
        "outside-uk",
        "unspecified",
      ],
    }).notNull(),
  },
  (table) => [
    check("household_singleton", sql`${table.id} = 1`),
    check(
      "household_size_valid",
      sql`${table.householdSize} > 0 AND ${table.householdSize} <= 9007199254740991`,
    ),
    check(
      "household_location_valid",
      sql`${table.location} IN ('england', 'wales', 'northern-ireland', 'scotland', 'outside-uk', 'unspecified')`,
    ),
  ],
);

export const plannerCollections = sqliteTable(
  "planner_collections",
  {
    id: text("id").primaryKey(),
    kind: text("kind", { enum: ["week", "template"] }).notNull(),
    status: text("status", { enum: ["active", "archived"] }),
    weekStart: text("week_start"),
    name: text("name"),
    revision: integer("revision").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    shopping: text("shopping").notNull().default("[]"),
  },
  (t) => [
    uniqueIndex("planner_one_active")
      .on(t.status)
      .where(sql`${t.status} = 'active'`),
    uniqueIndex("planner_week_date").on(t.weekStart),
    uniqueIndex("planner_template_name")
      .on(sql`lower(${t.name})`)
      .where(sql`${t.kind} = 'template'`),
    check(
      "planner_kind_valid",
      sql`(${t.kind} = 'week' AND ${t.status} IN ('active','archived') AND ${t.weekStart} IS NOT NULL AND ${t.name} IS NULL) OR (${t.kind} = 'template' AND ${t.status} IS NULL AND ${t.weekStart} IS NULL AND ${t.name} IS NOT NULL)`,
    ),
  ],
);

export const plannerMeals = sqliteTable(
  "planner_meals",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => plannerCollections.id, { onDelete: "cascade" }),
    sourceRecipeId: text("source_recipe_id").notNull(),
    snapshot: text("snapshot").notNull(),
    servings: integer("servings").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [
    index("planner_meals_owner").on(t.collectionId),
    check(
      "planner_servings_valid",
      sql`${t.servings} > 0 AND ${t.servings} <= 9007199254740991`,
    ),
  ],
);

export const plannerOperations = sqliteTable("planner_operations", {
  id: text("id").primaryKey(),
  request: text("request").notNull(),
  response: text("response").notNull(),
});

export const plannerPreviews = sqliteTable("planner_previews", {
  token: text("token").primaryKey(),
  collectionId: text("collection_id")
    .notNull()
    .references(() => plannerCollections.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  inputs: text("inputs").notNull(),
  expiresAt: text("expires_at").notNull(),
  result: text("result").notNull(),
});

export const householdDietary = sqliteTable(
  "household_dietary_preferences",
  {
    householdId: integer("household_id")
      .notNull()
      .references(() => householdSettings.id, { onDelete: "cascade" }),
    preference: text("preference", {
      enum: ["vegetarian", "vegan", "dairy-free", "gluten-free"],
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.householdId, table.preference] }),
    check(
      "household_preference_valid",
      sql`${table.preference} IN ('vegetarian', 'vegan', 'dairy-free', 'gluten-free')`,
    ),
  ],
);

export const recipes = sqliteTable(
  "recipes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    source: text("source", { enum: ["system", "user"] }).notNull(),
    cuisine: text("cuisine").notNull(),
    serves: integer("serves").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    archivedAt: text("archived_at"),
  },
  (table) => [
    check("recipes_source_check", sql`${table.source} in ('system', 'user')`),
    check("recipes_serves_positive_check", sql`${table.serves} > 0`),
  ],
);

export const recipeMealTypes = sqliteTable(
  "recipe_meal_types",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    mealType: text("meal_type").notNull(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.mealType] })],
);

export const recipeDietary = sqliteTable(
  "recipe_dietary",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    dietary: text("dietary").notNull(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.dietary] })],
);

export const recipeTags = sqliteTable(
  "recipe_tags",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tag: text("tag").notNull(),
  },
  (table) => [primaryKey({ columns: [table.recipeId, table.tag] })],
);

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    item: text("item").notNull(),
    quantity: real("quantity"),
    unit: text("unit"),
    prep: text("prep"),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.position] }),
    check("recipe_ingredients_position_check", sql`${table.position} >= 0`),
  ],
);

export const recipeMethodSteps = sqliteTable(
  "recipe_method_steps",
  {
    recipeId: text("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    instruction: text("instruction").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.recipeId, table.position] }),
    check("recipe_method_steps_position_check", sql`${table.position} >= 0`),
  ],
);
