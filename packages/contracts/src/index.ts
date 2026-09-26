import { z } from "zod";

// Public HTTP shapes only; development consumers watch these sources directly.
export const healthSchema = z.object({ status: z.literal("ok") });

export const statusSchema = z.object({
  status: z.literal("ready"),
  recipeCount: z.number().int().nonnegative(),
});

export const errorSchema = z.object({ code: z.string(), message: z.string() });

export type SystemStatus = z.infer<typeof statusSchema>;

export const recipeSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cuisine: z.string(),
  serves: z.number().int().positive(),
});

// A small read-only inspiration feed, not a paginated catalogue.
export const recipeSummariesSchema = z.object({
  recipes: z.array(recipeSummarySchema).max(20),
});

export type RecipeSummary = z.infer<typeof recipeSummarySchema>;
