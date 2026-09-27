import { z } from "zod";

export const dietaryPreferences = [
  "vegetarian",
  "vegan",
  "dairy-free",
  "gluten-free",
] as const;

export const householdLocations = [
  "england",
  "wales",
  "northern-ireland",
  "scotland",
  "outside-uk",
  "unspecified",
] as const;

export const householdSchema = z.object({
  householdSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  dietaryPreferences: z.array(z.enum(dietaryPreferences)),
  location: z.enum(householdLocations),
});

export type Household = z.infer<typeof householdSchema>;

export const defaultHousehold: Household = {
  householdSize: 1,
  dietaryPreferences: [],
  location: "england",
};

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
