import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app.js";
import { openStore } from "./db/index.js";

it("persists household settings without resetting them during seeding or restart", async () => {
  const folder = mkdtempSync(join(tmpdir(), "nosh-household-"));
  const path = join(folder, "test.sqlite");
  let app = await createApp(openStore(path));

  try {
    expect((await app.inject("/api/household")).json()).toEqual({
      householdSize: 1,
      dietaryPreferences: [],
      location: "england",
    });
    const payload = {
      householdSize: 4,
      dietaryPreferences: ["vegan", "vegetarian", "vegan"],
      location: "scotland",
    };
    const saved = await app.inject({
      method: "PUT",
      url: "/api/household",
      payload,
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({
      ...payload,
      dietaryPreferences: ["vegetarian", "vegan"],
    });

    for (const invalid of [
      { householdSize: 0 },
      { householdSize: 1.5 },
      { householdSize: Number.MAX_SAFE_INTEGER + 1 },
      { dietaryPreferences: ["unknown"] },
      { location: "unknown" },
    ]) {
      expect(
        (
          await app.inject({
            method: "PUT",
            url: "/api/household",
            payload: { ...payload, ...invalid },
          })
        ).statusCode,
      ).toBe(400);
      expect((await app.inject("/api/household")).json()).toEqual(saved.json());
    }

    await app.close();

    const store = openStore(path);
    store.seed();

    app = await createApp(store);

    expect((await app.inject("/api/household")).json()).toEqual(saved.json());
    expect(store.recipeCount()).toBe(20);

    const cleared = {
      householdSize: 1,
      dietaryPreferences: [],
      location: "unspecified",
    };
    expect(
      (
        await app.inject({
          method: "PUT",
          url: "/api/household",
          payload: cleared,
        })
      ).json(),
    ).toEqual(cleared);
    expect((await app.inject("/api/household")).json()).toEqual(cleared);
  } finally {
    await app.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
