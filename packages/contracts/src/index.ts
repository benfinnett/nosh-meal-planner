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

export const mealTypes = ["breakfast", "lunch", "dinner", "dessert"] as const;
const labelSchema = z.string().trim().min(1).max(100);
const nullableText = z.string().trim().max(200).nullable();

export const recipeIngredientSchema = z.object({
  item: z.string().trim().min(1).max(200),
  quantity: z.number().nonnegative().nullable(),
  unit: nullableText,
  prep: nullableText,
});

export const createRecipeSchema = z.object({
  name: z.string().trim().min(1, "Enter a recipe name.").max(200),
  cuisine: z.string().trim().max(100).default(""),
  serves: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  mealType: z.array(z.enum(mealTypes)).min(1, "Choose a meal type."),
  dietary: z.array(z.enum(dietaryPreferences)).default([]),
  tags: z.array(labelSchema).max(30).default([]),
  ingredients: z
    .array(
      recipeIngredientSchema.extend({
        quantity: z
          .number()
          .positive("Enter a quantity greater than zero.")
          .nullable(),
      }),
    )
    .min(1, "Add an ingredient.")
    .max(200),
  method: z
    .array(z.string().trim().min(1, "Enter a method step.").max(5000))
    .min(1, "Add a method step.")
    .max(200),
});

export const recipeCardSchema = recipeSummarySchema.extend({
  tags: z.array(z.string()),
});
export const recipeDetailSchema = recipeCardSchema.extend({
  source: z.enum(["system", "user"]),
  mealType: z.array(z.string()),
  dietary: z.array(z.string()),
  ingredients: z.array(recipeIngredientSchema),
  method: z.array(z.string()),
});

export const recipeCursorSchema = z.tuple([z.string(), z.string().min(1)]);
const queryValues = z
  .union([labelSchema, z.array(labelSchema)])
  .transform((value) => (typeof value === "string" ? [value] : value))
  .optional();
export const catalogueQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  dietary: queryValues,
  cuisine: queryValues,
  mealType: queryValues,
  tags: queryValues,
  limit: z.coerce.number().int().min(1).max(100).default(12),
  cursor: z
    .string()
    .max(1000)
    .refine((value) => {
      try {
        return recipeCursorSchema.safeParse(JSON.parse(value)).success;
      } catch {
        return false;
      }
    }, "Invalid recipe cursor.")
    .optional(),
});
export const recipeCatalogueSchema = z.object({
  recipes: z.array(recipeCardSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
});
export const recipeFilterOptionsSchema = z.object({
  cuisines: z.array(z.string()),
  mealTypes: z.array(z.string()),
  tags: z.array(z.string()),
});

export type CreateRecipe = z.infer<typeof createRecipeSchema>;
export type RecipeCard = z.infer<typeof recipeCardSchema>;
export type RecipeDetail = z.infer<typeof recipeDetailSchema>;
export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;
export type RecipeCatalogue = z.infer<typeof recipeCatalogueSchema>;
