import { randomUUID, createHash } from "node:crypto";
import type Database from "better-sqlite3";
import type { z } from "zod";
import {
  weekSchema,
  templateSchema,
  snapshotSchema,
  previewSchema,
  type StartWeek,
  type PlannerWrite,
  type Week,
  type MealTemplate,
  type ShoppingRow,
  type addMealSchema,
  type saveTemplateSchema,
  type checkShoppingSchema,
  type RecipeDetail,
  type Household,
} from "@nosh/contracts";
import {
  aggregate,
  reconcile,
  coverage,
  autofill,
  algorithmVersion,
  monday,
  addDays,
  suggestedMonday,
  type Meal,
} from "@nosh/meal-planning";

export class PlannerError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const conflict = (message: string): never => {
  throw new PlannerError(409, "CONFLICT", message);
};
const missing = (): never => {
  throw new PlannerError(
    404,
    "NOT_FOUND",
    "This plan, template or meal is no longer available.",
  );
};
interface CollectionRow {
  id: string;
  kind: "week" | "template";
  status: "active" | "archived" | null;
  week_start: string | null;
  name: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  shopping: string;
}

export function plannerStore(
  sqlite: Database.Database,
  source: {
    recipeDetail(id: string): RecipeDetail | undefined;
    household(): Household;
  },
) {
  function collection(id: string, kind?: "week" | "template") {
    const row = sqlite
      .prepare("SELECT * FROM planner_collections WHERE id = ?")
      .get(id) as CollectionRow | undefined;
    if (!row || (kind && kind !== row.kind)) return missing();
    return row;
  }
  function meals(id: string): Meal[] {
    const rows = sqlite
      .prepare(
        "SELECT * FROM planner_meals WHERE collection_id = ? ORDER BY position, rowid",
      )
      .all(id) as {
      id: string;
      source_recipe_id: string;
      snapshot: string;
      servings: number;
      position: number;
    }[];
    return rows.map((row) => ({
      id: row.id,
      sourceRecipeId: row.source_recipe_id,
      snapshot: snapshotSchema.parse(JSON.parse(row.snapshot)),
      servings: row.servings,
      order: row.position,
    }));
  }
  function currentRow() {
    return sqlite
      .prepare("SELECT * FROM planner_collections WHERE status = 'active'")
      .get() as CollectionRow | undefined;
  }
  function week(id: string): Week {
    const row = collection(id, "week"),
      selected = meals(id);
    return weekSchema.parse({
      id,
      weekStart: row.week_start,
      weekEnd: addDays(row.week_start!, 6),
      status: row.status,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      meals: selected,
      shopping: JSON.parse(row.shopping),
      coverage: coverage(selected),
    });
  }
  function template(id: string): MealTemplate {
    const row = collection(id, "template");
    return templateSchema.parse({
      id,
      name: row.name,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      meals: meals(id),
    });
  }
  function verify(row: CollectionRow, revision: number, editable = true) {
    if (editable && row.status === "archived")
      conflict("Archived weeks are read-only. Copy this week to make changes.");
    if (row.revision !== revision)
      conflict("This collection has changed. Refresh it and try again.");
  }
  function operation<T>(
    scope: string,
    input: { operationId: string },
    run: () => T,
  ): T {
    return sqlite.transaction(() => {
      const request = JSON.stringify([scope, input]);
      const cached = sqlite
        .prepare(
          "SELECT request, response FROM planner_operations WHERE id = ?",
        )
        .get(input.operationId) as
        { request: string; response: string } | undefined;
      if (cached) {
        if (cached.request !== request)
          conflict("This operation was already used for a different change.");
        return JSON.parse(cached.response) as T;
      }
      const result = run();
      sqlite
        .prepare(
          "INSERT INTO planner_operations (id, request, response) VALUES (?, ?, ?)",
        )
        .run(input.operationId, request, JSON.stringify(result));
      return result;
    })();
  }
  function insertMeals(id: string, selected: Meal[]) {
    const insert = sqlite.prepare(
      "INSERT INTO planner_meals (id, collection_id, source_recipe_id, snapshot, servings, position) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const meal of selected)
      insert.run(
        meal.id,
        id,
        meal.sourceRecipeId,
        JSON.stringify(meal.snapshot),
        meal.servings,
        meal.order,
      );
  }
  function copied(selected: Meal[], household = false): Meal[] {
    const servings = source.household().householdSize;
    return selected.map((meal, order) => ({
      ...meal,
      id: randomUUID(),
      order,
      servings: household ? servings : meal.servings,
    }));
  }
  function shopping(selected: Meal[], previous: ShoppingRow[]): ShoppingRow[] {
    const requirements = aggregate(selected);
    const overrides = reconcile(requirements, previous);
    return requirements.map((row) => ({
      ...row,
      checked: false,
      review: false,
      ...overrides.find((o) => o.key === row.key),
    }));
  }
  function changed(row: CollectionRow, selected: Meal[]) {
    const rows =
      row.kind === "week" ? shopping(selected, JSON.parse(row.shopping)) : [];
    sqlite
      .prepare("DELETE FROM planner_meals WHERE collection_id = ?")
      .run(row.id);
    insertMeals(row.id, selected);
    sqlite
      .prepare(
        "UPDATE planner_collections SET revision = revision + 1, updated_at = ?, shopping = ? WHERE id = ?",
      )
      .run(new Date().toISOString(), JSON.stringify(rows), row.id);
    return week(row.id);
  }
  function catalogue() {
    const ids = sqlite
      .prepare("SELECT id FROM recipes WHERE archived_at IS NULL ORDER BY id")
      .all() as { id: string }[];
    return ids.flatMap(({ id }) => {
      const result = snapshotSchema.safeParse({
        ...source.recipeDetail(id),
        version: 1,
      });
      return result.success ? [result.data] : [];
    });
  }
  function inputSignature() {
    return createHash("sha256")
      .update(JSON.stringify([source.household(), catalogue()]))
      .digest("hex");
  }
  function uniqueName(name: string, except = "") {
    const existing = sqlite
      .prepare(
        "SELECT id FROM planner_collections WHERE kind = 'template' AND lower(name) = lower(?) AND id != ?",
      )
      .get(name, except);
    if (existing)
      conflict(
        "A template with this name already exists. Update it or choose another name.",
      );
  }

  return {
    week,
    template,
    overview() {
      const row = currentRow();
      return {
        current: row ? week(row.id) : null,
        suggestedWeekStart: row
          ? addDays(row.week_start!, 7)
          : suggestedMonday(),
      };
    },
    history(offset: number) {
      const rows = sqlite
        .prepare(
          "SELECT id FROM planner_collections WHERE status = 'archived' ORDER BY week_start DESC LIMIT 21 OFFSET ?",
        )
        .all(offset) as { id: string }[];
      return {
        weeks: rows.slice(0, 20).map(({ id }) => {
          const value = week(id);
          return {
            id,
            weekStart: value.weekStart,
            weekEnd: value.weekEnd,
            status: value.status,
            revision: value.revision,
            createdAt: value.createdAt,
            updatedAt: value.updatedAt,
            mealCount: value.meals.length,
          };
        }),
        nextOffset: rows.length > 20 ? offset + 20 : null,
      };
    },
    templates() {
      const rows = sqlite
        .prepare(
          "SELECT id FROM planner_collections WHERE kind = 'template' ORDER BY name COLLATE NOCASE, id",
        )
        .all() as { id: string }[];
      return { templates: rows.map(({ id }) => template(id)) };
    },
    start(input: StartWeek) {
      return operation("start", input, () => {
        const active = currentRow();
        if (
          active
            ? !input.current ||
              input.current.id !== active.id ||
              input.current.revision !== active.revision
            : input.current !== null
        )
          conflict(
            "The active week changed. Review it before starting another week.",
          );
        if (!monday(input.weekStart))
          throw new PlannerError(
            400,
            "INVALID_INPUT",
            "Choose a Monday for the start of the week.",
          );
        addDays(input.weekStart, 6);
        if (active && input.weekStart <= active.week_start!)
          conflict("Choose a week after the active week.");
        if (
          sqlite
            .prepare("SELECT id FROM planner_collections WHERE week_start = ?")
            .get(input.weekStart)
        )
          conflict("A plan already exists for these dates.");
        let selected: Meal[] = [];
        if (input.source) {
          const from = collection(input.source.id, input.source.kind);
          verify(from, input.source.revision, false);
          selected = copied(
            meals(from.id),
            input.servingsPolicy === "household",
          );
        }
        const now = new Date().toISOString(),
          id = randomUUID();
        if (active)
          sqlite
            .prepare(
              "UPDATE planner_collections SET status = 'archived', revision = revision + 1, updated_at = ? WHERE id = ?",
            )
            .run(now, active.id);
        sqlite
          .prepare(
            "INSERT INTO planner_collections (id, kind, status, week_start, created_at, updated_at, shopping) VALUES (?, 'week', 'active', ?, ?, ?, ?)",
          )
          .run(
            id,
            input.weekStart,
            now,
            now,
            JSON.stringify(shopping(selected, [])),
          );
        insertMeals(id, selected);
        return week(id);
      });
    },
    addMeal(id: string, input: z.infer<typeof addMealSchema>) {
      return operation(`add:${id}`, input, () => {
        const row = collection(id, "week");
        verify(row, input.expectedRevision);
        const selected = meals(id);
        const snapshot = input.copyOccurrenceId
          ? selected.find((m) => m.id === input.copyOccurrenceId)?.snapshot
          : { ...source.recipeDetail(input.recipeId!), version: 1 };
        if (!snapshot) return missing();
        const parsed = snapshotSchema.safeParse(snapshot);
        if (!parsed.success)
          throw new PlannerError(
            400,
            "INVALID_RECIPE",
            "This recipe is unavailable or has invalid quantities.",
          );
        const next: Meal = {
          id: randomUUID(),
          sourceRecipeId: parsed.data.id,
          snapshot: parsed.data,
          servings: input.servings,
          order: Math.max(-1, ...selected.map((m) => m.order)) + 1,
        };
        return changed(row, [...selected, next]);
      });
    },
    changeMeal(
      id: string,
      mealId: string,
      input: PlannerWrite & { servings?: number },
    ) {
      return operation(`meal:${id}:${mealId}`, input, () => {
        const row = collection(id, "week");
        verify(row, input.expectedRevision);
        const selected = meals(id);
        if (!selected.some((m) => m.id === mealId)) return missing();
        return changed(
          row,
          input.servings === undefined
            ? selected.filter((m) => m.id !== mealId)
            : selected.map((m) =>
                m.id === mealId ? { ...m, servings: input.servings! } : m,
              ),
        );
      });
    },
    check(id: string, input: z.infer<typeof checkShoppingSchema>) {
      return operation(`shopping:${id}`, input, () => {
        const row = collection(id, "week");
        verify(row, input.expectedRevision);
        const rows = JSON.parse(row.shopping) as ShoppingRow[];
        const target = rows.find((r) => r.key === input.key);
        if (!target || target.fingerprint !== input.fingerprint)
          return conflict(
            "The required quantity changed. Check the updated list.",
          );
        target.checked = input.checked;
        target.review = false;
        sqlite
          .prepare(
            "UPDATE planner_collections SET revision = revision + 1, shopping = ?, updated_at = ? WHERE id = ?",
          )
          .run(JSON.stringify(rows), new Date().toISOString(), id);
        return week(id);
      });
    },
    saveTemplate(input: z.infer<typeof saveTemplateSchema>) {
      return operation("template:save", input, () => {
        const from = collection(input.source.id, "week");
        verify(from, input.source.revision, false);
        const selected = copied(meals(from.id));
        const now = new Date().toISOString();
        const id = input.target?.id ?? randomUUID();
        if (input.target)
          verify(collection(id, "template"), input.target.revision);
        uniqueName(input.name, id);
        if (input.target) {
          sqlite
            .prepare(
              "UPDATE planner_collections SET name = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
            )
            .run(input.name, now, id);
          sqlite
            .prepare("DELETE FROM planner_meals WHERE collection_id = ?")
            .run(id);
        } else
          sqlite
            .prepare(
              "INSERT INTO planner_collections (id, kind, name, created_at, updated_at) VALUES (?, 'template', ?, ?, ?)",
            )
            .run(id, input.name, now, now);
        insertMeals(id, selected);
        return template(id);
      });
    },
    renameTemplate(id: string, input: PlannerWrite & { name: string }) {
      return operation(`template:rename:${id}`, input, () => {
        verify(collection(id, "template"), input.expectedRevision);
        uniqueName(input.name, id);
        sqlite
          .prepare(
            "UPDATE planner_collections SET name = ?, revision = revision + 1, updated_at = ? WHERE id = ?",
          )
          .run(input.name, new Date().toISOString(), id);
        return template(id);
      });
    },
    deleteTemplate(id: string, input: PlannerWrite) {
      return operation(`template:delete:${id}`, input, () => {
        verify(collection(id, "template"), input.expectedRevision);
        sqlite.prepare("DELETE FROM planner_collections WHERE id = ?").run(id);
        return { deleted: true };
      });
    },
    preview(id: string, expectedRevision: number, seed: number) {
      return sqlite.transaction(() => {
        verify(collection(id, "week"), expectedRevision);
        const household = source.household();
        const result = autofill(
          meals(id),
          catalogue(),
          household.householdSize,
          household.dietaryPreferences,
          seed,
        );
        const token = randomUUID(),
          expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        const preview = {
          token,
          seed,
          algorithmVersion,
          expiresAt,
          coverage: result.coverage,
          additions: result.additions.map((m) => ({ ...m, id: randomUUID() })),
        };
        sqlite
          .prepare("DELETE FROM planner_previews WHERE expires_at < ?")
          .run(new Date().toISOString());
        sqlite
          .prepare(
            "INSERT INTO planner_previews (token, collection_id, revision, inputs, expires_at, result) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .run(
            token,
            id,
            expectedRevision,
            inputSignature(),
            expiresAt,
            JSON.stringify(preview),
          );
        return preview;
      })();
    },
    apply(id: string, input: PlannerWrite & { token: string }) {
      return operation(`autofill:${id}`, input, () => {
        const row = collection(id, "week");
        verify(row, input.expectedRevision);
        const preview = sqlite
          .prepare(
            "SELECT * FROM planner_previews WHERE token = ? AND collection_id = ?",
          )
          .get(input.token, id) as
          | {
              revision: number;
              inputs: string;
              expires_at: string;
              result: string;
            }
          | undefined;
        if (
          !preview ||
          preview.revision !== row.revision ||
          preview.expires_at <= new Date().toISOString() ||
          preview.inputs !== inputSignature()
        )
          return conflict(
            "This suggestion is out of date. Generate another mix.",
          );
        const result = changed(row, [
          ...meals(id),
          ...previewSchema.parse(JSON.parse(preview.result)).additions,
        ]);
        sqlite
          .prepare("DELETE FROM planner_previews WHERE collection_id = ?")
          .run(id);
        return result;
      });
    },
  };
}
