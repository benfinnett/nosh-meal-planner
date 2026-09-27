import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { openStore } from "./db/index.js";

const apps: Awaited<ReturnType<typeof createApp>>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const app = await createApp(openStore(":memory:"));
  apps.push(app);
  return app;
}

const recipe = {
  name: "Bean stew",
  cuisine: "british",
  serves: 4,
  mealType: ["dinner"],
  dietary: ["vegetarian"],
  tags: ["quick"],
  ingredients: [
    { item: "beans", quantity: 250, unit: "g", prep: "drained" },
    { item: "salt", quantity: null, unit: null, prep: null },
  ],
  method: ["Drain the beans.", "Simmer and season."],
};

describe("recipe catalogue HTTP API", () => {
  it("persists a complete custom recipe and preserves ordered content", async () => {
    const app = await setup();
    const response = await app.inject({
      method: "POST",
      url: "/api/recipes",
      payload: {
        ...recipe,
        name: "  Bean stew  ",
        tags: [" Quick ", "quick", "Batch-cook"],
      },
    });
    expect(response.statusCode).toBe(201);
    const created = response.json();
    expect(created).toMatchObject({
      ...recipe,
      name: "Bean stew",
      source: "user",
      tags: ["batch-cook", "quick"],
    });
    expect(created.id).toEqual(expect.any(String));
    const detail = await app.inject(`/api/recipes/${created.id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toEqual(created);
    const list = (await app.inject("/api/recipes/catalogue?q=BEAN")).json();
    expect(list).toMatchObject({
      total: 1,
      nextCursor: null,
      recipes: [{ id: created.id, tags: ["batch-cook", "quick"] }],
    });
  });

  it("filters the catalogue to user recipes", async () => {
    const store = openStore(":memory:");
    store.seed();
    const app = await createApp(store);
    apps.push(app);
    const created = await app.inject({
      method: "POST",
      url: "/api/recipes",
      payload: recipe,
    });
    const list = await app.inject("/api/recipes/catalogue?mine=true");

    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({
      total: 1,
      recipes: [{ id: created.json().id, name: recipe.name }],
    });
  });

  it("rejects invalid creation without a partial recipe and validates pagination", async () => {
    const app = await setup();
    for (const invalid of [
      { ...recipe, name: " " },
      { ...recipe, serves: 0 },
      { ...recipe, mealType: [] },
      { ...recipe, ingredients: [] },
      { ...recipe, method: [" "] },
      {
        ...recipe,
        ingredients: [{ item: "beans", quantity: -1, unit: null, prep: null }],
      },
    ])
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/recipes",
            payload: invalid,
          })
        ).statusCode,
      ).toBe(400);
    expect((await app.inject("/api/recipes/catalogue")).json()).toEqual({
      recipes: [],
      total: 0,
      nextCursor: null,
    });
    expect(
      (await app.inject("/api/recipes/catalogue?cursor=invalid")).statusCode,
    ).toBe(400);
    expect(
      (await app.inject("/api/recipes/catalogue?limit=101")).statusCode,
    ).toBe(400);
    expect((await app.inject("/api/recipes/missing")).statusCode).toBe(404);
  });
});
