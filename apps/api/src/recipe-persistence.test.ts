import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { expect, it } from "vitest";
import { createApp } from "./app.js";
import { openStore } from "./db/index.js";

it("excludes archived recipes and rolls back the complete creation on a storage failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "nosh-recipes-"));
  const path = join(directory, "test.sqlite");
  const store = openStore(path);
  store.seed();
  const app = await createApp(store);
  const fixture = new Database(path);
  try {
    // Arrange storage-only states through a fixture; observe behaviour over HTTP.
    fixture
      .prepare("UPDATE recipes SET archived_at = ? WHERE id = ?")
      .run(new Date().toISOString(), "apple-crumble");
    expect((await app.inject("/api/recipes/apple-crumble")).statusCode).toBe(
      404,
    );
    expect(
      (await app.inject("/api/recipes/catalogue?q=apple%20crumble")).json()
        .total,
    ).toBe(0);
    fixture
      .prepare("UPDATE recipes SET archived_at = ? WHERE cuisine = ?")
      .run(new Date().toISOString(), "thai");
    expect(
      (await app.inject("/api/recipes/filter-options")).json().cuisines,
    ).not.toContain("thai");
    const before = (await app.inject("/api/recipes/catalogue")).json().total;
    fixture.exec(
      "CREATE TRIGGER fail_method BEFORE INSERT ON recipe_method_steps BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    );
    const created = await app.inject({
      method: "POST",
      url: "/api/recipes",
      payload: {
        name: "Must roll back",
        cuisine: "new-cuisine",
        serves: 2,
        mealType: ["dinner"],
        dietary: [],
        tags: ["new-tag"],
        ingredients: [
          { item: "beans", quantity: null, unit: null, prep: null },
        ],
        method: ["Simmer."],
      },
    });
    expect(created.statusCode).toBe(500);
    expect((await app.inject("/api/recipes/catalogue")).json().total).toBe(
      before,
    );
    expect(
      (await app.inject("/api/recipes/filter-options")).json().tags,
    ).not.toContain("new-tag");
  } finally {
    fixture.close();
    await app.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
