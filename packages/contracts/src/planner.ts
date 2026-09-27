import { z } from "zod";
import { recipeDetailSchema } from "./recipes.js";

export const servingsSchema = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const revisionSchema = z.number().int().nonnegative();
export const snapshotSchema = recipeDetailSchema.extend({
  version: z.literal(1),
  serves: servingsSchema,
});
export const mealSchema = z.object({
  id: z.string(),
  sourceRecipeId: z.string(),
  snapshot: snapshotSchema,
  servings: servingsSchema,
  order: z.number().int().nonnegative(),
});
const attributionSchema = z.object({
  occurrenceId: z.string(),
  recipeName: z.string(),
  position: z.number().int(),
  prep: z.string().nullable(),
  servings: servingsSchema,
});
export const shoppingRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  fingerprint: z.string(),
  checked: z.boolean(),
  review: z.boolean(),
  components: z.array(
    z.object({
      unit: z.string().nullable(),
      quantity: z
        .object({ numerator: z.string(), denominator: z.string() })
        .nullable(),
      unknown: z.number().int(),
      display: z.string(),
      suggested: z.string().nullable(),
      attribution: z.array(attributionSchema),
    }),
  ),
  attribution: z.array(attributionSchema),
});
export const coverageSchema = z.object({
  breakfast: z.number().int(),
  lunch: z.number().int(),
  dinner: z.number().int(),
});
export const weekSchema = z.object({
  id: z.string(),
  weekStart: z.string(),
  weekEnd: z.string(),
  status: z.enum(["active", "archived"]),
  revision: revisionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  meals: z.array(mealSchema),
  shopping: z.array(shoppingRowSchema),
  coverage: coverageSchema,
});
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  revision: revisionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  meals: z.array(mealSchema),
});
export const weekSummarySchema = weekSchema
  .omit({ meals: true, shopping: true, coverage: true })
  .extend({ mealCount: z.number().int() });
export const plannerSchema = z.object({
  current: weekSchema.nullable(),
  suggestedWeekStart: z.string(),
});
export const historySchema = z.object({
  weeks: z.array(weekSummarySchema),
  nextOffset: z.number().int().nullable(),
});
export const templatesSchema = z.object({ templates: z.array(templateSchema) });
export const sourceRefSchema = z.object({
  id: z.string().min(1),
  revision: revisionSchema,
});
export const writeSchema = z.object({
  operationId: z.uuid(),
  expectedRevision: revisionSchema,
});
export const startWeekSchema = z.object({
  operationId: z.uuid(),
  weekStart: z.string(),
  current: sourceRefSchema.nullable(),
  source: sourceRefSchema
    .extend({ kind: z.enum(["week", "template"]) })
    .optional(),
  servingsPolicy: z.enum(["preserve", "household"]).default("preserve"),
});
export const addMealSchema = writeSchema
  .extend({
    recipeId: z.string().min(1).optional(),
    copyOccurrenceId: z.string().min(1).optional(),
    servings: servingsSchema,
  })
  .refine(
    (v) => Boolean(v.recipeId) !== Boolean(v.copyOccurrenceId),
    "Choose a recipe or a captured occurrence.",
  );
export const changeMealSchema = writeSchema.extend({
  servings: servingsSchema,
});
export const checkShoppingSchema = writeSchema.extend({
  key: z.string(),
  fingerprint: z.string(),
  checked: z.boolean(),
});
export const templateNameSchema = z.string().trim().min(1).max(100);
export const saveTemplateSchema = z.object({
  operationId: z.uuid(),
  name: templateNameSchema,
  source: sourceRefSchema,
  target: sourceRefSchema.optional(),
});
export const renameTemplateSchema = writeSchema.extend({
  name: templateNameSchema,
});
export const previewRequestSchema = z.object({
  expectedRevision: revisionSchema,
  seed: z.number().int().min(0).max(4294967295),
});
export const previewSchema = z.object({
  token: z.string(),
  seed: z.number(),
  algorithmVersion: z.number(),
  expiresAt: z.string(),
  additions: z.array(mealSchema),
  coverage: coverageSchema,
});
export const applyAutofillSchema = writeSchema.extend({ token: z.string() });
export type Week = z.infer<typeof weekSchema>;
export type MealTemplate = z.infer<typeof templateSchema>;
export type PlannedMeal = z.infer<typeof mealSchema>;
export type ShoppingRow = z.infer<typeof shoppingRowSchema>;
export type AutofillPreview = z.infer<typeof previewSchema>;
export type StartWeek = z.infer<typeof startWeekSchema>;
export type PlannerWrite = z.infer<typeof writeSchema>;
