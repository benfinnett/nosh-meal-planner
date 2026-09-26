import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { openStore } from "./db/index.js";

describe("recipe summaries", () => {
  it("returns bounded, deterministic summaries from the real seed", async () => {
    const store = openStore(":memory:");
    store.seed();
    const app = await createApp(store);
    try {
      const response = await app.inject("/api/recipes");
      expect(response.statusCode).toBe(200);
      const { recipes } = response.json();
      expect(recipes).toHaveLength(20);
      expect(recipes[0]).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        cuisine: expect.any(String),
        serves: expect.any(Number),
      });
      expect(recipes.map((recipe: { id: string }) => recipe.id)).toEqual(
        [...recipes.map((recipe: { id: string }) => recipe.id)].sort(),
      );
      expect((await app.inject("/api/recipes")).json()).toEqual(
        response.json(),
      );
    } finally {
      await app.close();
    }
  });

  it("returns an empty list for an unseeded store", async () => {
    const app = await createApp(openStore(":memory:"));
    try {
      expect((await app.inject("/api/recipes")).json()).toEqual({
        recipes: [],
      });
    } finally {
      await app.close();
    }
  });
});
