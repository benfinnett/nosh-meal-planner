import Database from "better-sqlite3";
import { recipeStore } from "./recipe-store.js";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { asc, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  defaultHousehold,
  dietaryPreferences,
  type Household,
} from "@nosh/contracts";
import {
  recipeDietary,
  recipeIngredients,
  recipeMealTypes,
  recipeMethodSteps,
  recipeTags,
  recipes,
  householdSettings,
  householdDietary,
} from "./schema.js";

const migrationsFolder = fileURLToPath(
  new URL("../../migrations/generated", import.meta.url),
);

const seedSchema = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    cuisine: z.string(),
    serves: z.number().int().positive(),
    mealType: z.array(z.string()),
    dietary: z.array(z.string()),
    tags: z.array(z.string()),
    ingredients: z.array(
      z.object({
        item: z.string().min(1),
        quantity: z.number().nonnegative().nullable(),
        unit: z.string().nullable(),
        prep: z.string().optional(),
      }),
    ),
    method: z.array(z.string().min(1)).min(1),
  }),
);

export function openStore(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite);

  try {
    migrate(db, { migrationsFolder });
  } catch (error) {
    sqlite.close();
    throw error;
  }

  return {
    ...recipeStore(sqlite),
    household(): Household {
      const row = db
        .select()
        .from(householdSettings)
        .where(eq(householdSettings.id, 1))
        .get();
      if (!row) return { ...defaultHousehold, dietaryPreferences: [] };
      const selected = db
        .select()
        .from(householdDietary)
        .where(eq(householdDietary.householdId, 1))
        .all();
      return {
        householdSize: row.householdSize,
        location: row.location,
        dietaryPreferences: dietaryPreferences.filter((value) =>
          selected.some((entry) => entry.preference === value),
        ),
      };
    },

    saveHousehold(input: Household): Household {
      const selected = dietaryPreferences.filter((value) =>
        input.dietaryPreferences.includes(value),
      );
      sqlite.transaction(() => {
        db.insert(householdSettings)
          .values({
            id: 1,
            householdSize: input.householdSize,
            location: input.location,
          })
          .onConflictDoUpdate({
            target: householdSettings.id,
            set: {
              householdSize: input.householdSize,
              location: input.location,
            },
          })
          .run();
        db.delete(householdDietary)
          .where(eq(householdDietary.householdId, 1))
          .run();
        if (selected.length)
          db.insert(householdDietary)
            .values(
              selected.map((preference) => ({ householdId: 1, preference })),
            )
            .run();
      })();
      return { ...input, dietaryPreferences: selected };
    },

    seed() {
      const input = JSON.parse(
        readFileSync(
          fileURLToPath(
            new URL("../../project-nosh-sample-recipes.json", import.meta.url),
          ),
          "utf8",
        ),
      );

      const entries = seedSchema.parse(input);
      if (new Set(entries.map((entry) => entry.id)).size !== entries.length)
        throw new Error("Duplicate starter recipe IDs");

      const timestamp = new Date().toISOString();

      sqlite.transaction(() => {
        for (const recipe of entries) {
          const existing = db
            .select({ source: recipes.source })
            .from(recipes)
            .where(eq(recipes.id, recipe.id))
            .get();

          if (existing?.source === "user") continue;

          db.insert(recipes)
            .values({
              id: recipe.id,
              name: recipe.name,
              source: "system",
              cuisine: recipe.cuisine,
              serves: recipe.serves,
              createdAt: timestamp,
              updatedAt: timestamp,
              archivedAt: null,
            })
            .onConflictDoUpdate({
              target: recipes.id,
              set: {
                name: recipe.name,
                source: "system",
                cuisine: recipe.cuisine,
                serves: recipe.serves,
                updatedAt: timestamp,
              },
            })
            .run();

          db.delete(recipeMealTypes)
            .where(eq(recipeMealTypes.recipeId, recipe.id))
            .run();
          db.delete(recipeDietary)
            .where(eq(recipeDietary.recipeId, recipe.id))
            .run();
          db.delete(recipeTags).where(eq(recipeTags.recipeId, recipe.id)).run();
          db.delete(recipeIngredients)
            .where(eq(recipeIngredients.recipeId, recipe.id))
            .run();
          db.delete(recipeMethodSteps)
            .where(eq(recipeMethodSteps.recipeId, recipe.id))
            .run();

          if (recipe.mealType.length)
            db.insert(recipeMealTypes)
              .values(
                recipe.mealType.map((mealType) => ({
                  recipeId: recipe.id,
                  mealType,
                })),
              )
              .run();

          if (recipe.dietary.length)
            db.insert(recipeDietary)
              .values(
                recipe.dietary.map((dietary) => ({
                  recipeId: recipe.id,
                  dietary,
                })),
              )
              .run();

          if (recipe.tags.length)
            db.insert(recipeTags)
              .values(recipe.tags.map((tag) => ({ recipeId: recipe.id, tag })))
              .run();

          db.insert(recipeIngredients)
            .values(
              recipe.ingredients.map((ingredient, position) => ({
                recipeId: recipe.id,
                position,
                item: ingredient.item,
                quantity: ingredient.quantity,
                unit: ingredient.unit,
                prep: ingredient.prep ?? null,
              })),
            )
            .run();

          db.insert(recipeMethodSteps)
            .values(
              recipe.method.map((instruction, position) => ({
                recipeId: recipe.id,
                position,
                instruction,
              })),
            )
            .run();
        }
      })();
    },

    recipeCount() {
      return db.select({ value: count() }).from(recipes).get()!.value;
    },

    close() {
      sqlite.close();
    },

    recipeSummaries() {
      return db
        .select({
          id: recipes.id,
          name: recipes.name,
          cuisine: recipes.cuisine,
          serves: recipes.serves,
        })
        .from(recipes)
        .where(isNull(recipes.archivedAt))
        .orderBy(asc(recipes.id))
        .limit(20)
        .all();
    },
  };
}

export type Store = ReturnType<typeof openStore>;
