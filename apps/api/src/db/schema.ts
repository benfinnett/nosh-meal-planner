import {
  check,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
