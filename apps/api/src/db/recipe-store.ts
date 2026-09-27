import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  recipeCursorSchema,
  type CatalogueQuery,
  type CreateRecipe,
  type RecipeCard,
  type RecipeDetail,
} from "@nosh/contracts";

function labels(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))].sort();
}

export function recipeStore(sqlite: Database.Database) {
  function values(table: string, column: string, id: string) {
    // Identifiers here are fixed internal constants, never request values.
    return (
      sqlite
        .prepare(
          `SELECT ${column} AS value FROM ${table} WHERE recipe_id = ? ORDER BY ${column} COLLATE NOCASE, ${column}`,
        )
        .all(id) as { value: string }[]
    ).map((row) => row.value);
  }

  function recipeDetail(id: string): RecipeDetail | undefined {
    const row = sqlite
      .prepare(
        "SELECT id, name, cuisine, serves, source FROM recipes WHERE id = ? AND archived_at IS NULL",
      )
      .get(id) as
      | Omit<
          RecipeDetail,
          "tags" | "dietary" | "mealType" | "ingredients" | "method"
        >
      | undefined;
    if (!row) return undefined;

    return {
      ...row,
      tags: values("recipe_tags", "tag", id),
      dietary: values("recipe_dietary", "dietary", id),
      mealType: values("recipe_meal_types", "meal_type", id),
      ingredients: sqlite
        .prepare(
          "SELECT item, quantity, unit, prep FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position",
        )
        .all(id) as RecipeDetail["ingredients"],
      method: (
        sqlite
          .prepare(
            "SELECT instruction FROM recipe_method_steps WHERE recipe_id = ? ORDER BY position",
          )
          .all(id) as { instruction: string }[]
      ).map((row) => row.instruction),
    };
  }

  return {
    recipeDetail,

    recipeCatalogue(query: CatalogueQuery) {
      const predicates = ["r.archived_at IS NULL"];
      const params: (string | number)[] = [];
      if (query.q) {
        predicates.push("instr(lower(r.name), lower(?)) > 0");
        params.push(query.q);
      }
      if (query.cuisine?.length) {
        predicates.push(
          `lower(r.cuisine) IN (${query.cuisine.map(() => "?").join(",")})`,
        );
        params.push(...query.cuisine.map((value) => value.toLowerCase()));
      }
      for (const [selected, table, column] of [
        [query.dietary, "recipe_dietary", "dietary"],
        [query.mealType, "recipe_meal_types", "meal_type"],
        [query.tags, "recipe_tags", "tag"],
      ] as const) {
        if (!selected?.length) continue;
        predicates.push(
          `EXISTS (SELECT 1 FROM ${table} f WHERE f.recipe_id = r.id AND lower(f.${column}) IN (${selected.map(() => "?").join(",")}))`,
        );
        params.push(...selected.map((value) => value.toLowerCase()));
      }

      const { total } = sqlite
        .prepare(
          `SELECT count(*) AS total FROM recipes r WHERE ${predicates.join(" AND ")}`,
        )
        .get(...params) as { total: number };
      if (query.cursor) {
        const [name, id] = recipeCursorSchema.parse(JSON.parse(query.cursor));
        predicates.push(
          "(lower(r.name) > ? OR (lower(r.name) = ? AND r.id > ?))",
        );
        params.push(name, name, id);
      }
      const rows = sqlite
        .prepare(
          `SELECT r.id, r.name, r.cuisine, r.serves, lower(r.name) AS sortName FROM recipes r WHERE ${predicates.join(" AND ")} ORDER BY lower(r.name), r.id LIMIT ?`,
        )
        .all(...params, query.limit + 1) as (Omit<RecipeCard, "tags"> & {
        sortName: string;
      })[];
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        recipes: page.map((row) => ({
          id: row.id,
          name: row.name,
          cuisine: row.cuisine,
          serves: row.serves,
          tags: values("recipe_tags", "tag", row.id),
        })),
        total,
        nextCursor:
          rows.length > query.limit && last
            ? JSON.stringify([last.sortName, last.id])
            : null,
      };
    },

    recipeFilterOptions() {
      function distinct(table: string, column: string) {
        return (
          sqlite
            .prepare(
              `SELECT DISTINCT lower(f.${column}) AS value FROM ${table} f JOIN recipes r ON ${table === "recipes" ? "f.id" : "f.recipe_id"} = r.id WHERE r.archived_at IS NULL AND f.${column} != '' ORDER BY value`,
            )
            .all() as { value: string }[]
        ).map((row) => row.value);
      }
      return {
        cuisines: distinct("recipes", "cuisine"),
        mealTypes: distinct("recipe_meal_types", "meal_type"),
        tags: distinct("recipe_tags", "tag"),
      };
    },

    createRecipe(input: CreateRecipe) {
      const id = randomUUID();
      const now = new Date().toISOString();
      sqlite.transaction(() => {
        sqlite
          .prepare(
            "INSERT INTO recipes (id, name, source, cuisine, serves, created_at, updated_at) VALUES (?, ?, 'user', ?, ?, ?, ?)",
          )
          .run(
            id,
            input.name,
            input.cuisine.toLowerCase(),
            input.serves,
            now,
            now,
          );
        for (const [entries, table, column] of [
          [input.tags, "recipe_tags", "tag"],
          [input.dietary, "recipe_dietary", "dietary"],
          [input.mealType, "recipe_meal_types", "meal_type"],
        ] as const) {
          const insert = sqlite.prepare(
            `INSERT INTO ${table} (recipe_id, ${column}) VALUES (?, ?)`,
          );
          for (const value of labels(entries)) insert.run(id, value);
        }
        const ingredient = sqlite.prepare(
          "INSERT INTO recipe_ingredients (recipe_id, position, item, quantity, unit, prep) VALUES (?, ?, ?, ?, ?, ?)",
        );
        input.ingredients.forEach((entry, position) =>
          ingredient.run(
            id,
            position,
            entry.item,
            entry.quantity,
            entry.unit || null,
            entry.prep || null,
          ),
        );
        const step = sqlite.prepare(
          "INSERT INTO recipe_method_steps (recipe_id, position, instruction) VALUES (?, ?, ?)",
        );
        input.method.forEach((instruction, position) =>
          step.run(id, position, instruction),
        );
      })();
      return recipeDetail(id)!;
    },
  };
}
