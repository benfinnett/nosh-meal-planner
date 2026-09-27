import { recipeSummariesSchema, statusSchema } from "@nosh/contracts";
import { householdSchema, type Household } from "@nosh/contracts";
import {
  recipeCatalogueSchema,
  recipeDetailSchema,
  recipeFilterOptionsSchema,
  type CreateRecipe,
} from "@nosh/contracts";

export class RecipeApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchCatalogue(
  params: URLSearchParams,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/recipes/catalogue?${params}`, { signal });
  if (!response.ok)
    throw new RecipeApiError(response.status, "Couldn’t load recipes.");
  return recipeCatalogueSchema.parse(await response.json());
}

export async function fetchRecipeOptions({
  signal,
}: { signal?: AbortSignal } = {}) {
  const response = await fetch("/api/recipes/filter-options", { signal });
  if (!response.ok)
    throw new RecipeApiError(response.status, "Couldn’t load filter options.");
  return recipeFilterOptionsSchema.parse(await response.json());
}

export async function fetchRecipe(id: string, signal?: AbortSignal) {
  const response = await fetch(`/api/recipes/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!response.ok)
    throw new RecipeApiError(response.status, "Couldn’t load recipe.");
  return recipeDetailSchema.parse(await response.json());
}

export async function createRecipe(recipe: CreateRecipe) {
  const response = await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(recipe),
  });
  if (!response.ok)
    throw new RecipeApiError(
      response.status,
      "Couldn’t save your recipe. Please try again.",
    );
  return recipeDetailSchema.parse(await response.json());
}

export async function fetchHousehold({
  signal,
}: { signal?: AbortSignal } = {}) {
  const response = await fetch("/api/household", { signal });
  if (!response.ok) throw new Error("Couldn’t load household settings.");
  return householdSchema.parse(await response.json());
}

export async function saveHousehold(household: Household) {
  const response = await fetch("/api/household", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(household),
  });
  if (!response.ok) throw new Error("Couldn’t save household settings.");
  return householdSchema.parse(await response.json());
}

export async function fetchRecipeSummaries({
  signal,
}: { signal?: AbortSignal } = {}) {
  const response = await fetch("/api/recipes", { signal });
  if (!response.ok) throw new Error("The recipe API is unavailable.");

  const parsed = recipeSummariesSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("The API returned an unexpected response.");

  return parsed.data.recipes;
}

export async function fetchStatus() {
  const response = await fetch("/api/dev/status");
  if (!response.ok)
    throw new Error(
      "The API is unavailable. Check that the development server is running.",
    );

  const parsed = statusSchema.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("The API returned an unexpected response.");

  return parsed.data;
}
