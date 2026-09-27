import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { openStore } from "./db/index.js";

async function setup(path = ":memory:") {
  const store = openStore(path);
  const app = await createApp(store);
  const recipe = store.createRecipe({
    name: "Test rice",
    cuisine: "",
    serves: 4,
    mealType: ["dinner"],
    dietary: ["vegan"],
    tags: [],
    ingredients: [{ item: "Rice", quantity: 300, unit: "g", prep: null }],
    method: ["Cook"],
  });
  const write = (
    url: string,
    payload: object,
    method: "POST" | "PATCH" | "PUT" | "DELETE" = "POST",
  ) => app.inject({ method, url: `/api${url}`, payload });
  const create = async () =>
    (
      await write("/weeks", {
        operationId: randomUUID(),
        weekStart: "2026-09-28",
        current: null,
        servingsPolicy: "preserve",
      })
    ).json();
  return { app, store, recipe, write, create };
}

describe("persisted meal collections", () => {
  it("creates only explicitly, scales duplicates and guards revisions and retries", async () => {
    const { app, recipe, write, create } = await setup();
    try {
      expect((await app.inject("/api/planner")).json().current).toBeNull();
      let week = await create();
      expect(week.status).toBe("active");
      const add = {
        operationId: randomUUID(),
        expectedRevision: week.revision,
        recipeId: recipe.id,
        servings: 2,
      };
      const added = await write(`/weeks/${week.id}/meals`, add);
      expect(added.statusCode).toBe(200);
      week = added.json();
      expect(week.meals[0]).toMatchObject({
        servings: 2,
        snapshot: { name: "Test rice" },
      });
      expect(week.meals[0]).not.toHaveProperty("slot");
      expect((await write(`/weeks/${week.id}/meals`, add)).json()).toEqual(
        week,
      );
      expect(
        (await write(`/weeks/${week.id}/meals`, { ...add, servings: 3 }))
          .statusCode,
      ).toBe(409);
      expect(
        (
          await write(
            `/weeks/${week.id}/meals/${week.meals[0].id}`,
            { operationId: randomUUID(), expectedRevision: 0, servings: 3 },
            "PATCH",
          )
        ).statusCode,
      ).toBe(409);
      week = (
        await write(`/weeks/${week.id}/meals`, {
          ...add,
          operationId: randomUUID(),
          expectedRevision: week.revision,
        })
      ).json();
      expect(week.meals).toHaveLength(2);
      expect(week.shopping[0].components[0].display).toBe("300 g");
    } finally {
      await app.close();
    }
  });

  it("reconciles checks and freezes history atomically when starting a copied week", async () => {
    const { app, recipe, write, create } = await setup();
    try {
      let week = await create();
      week = (
        await write(`/weeks/${week.id}/meals`, {
          operationId: randomUUID(),
          expectedRevision: week.revision,
          recipeId: recipe.id,
          servings: 2,
        })
      ).json();
      const row = week.shopping[0];
      week = (
        await write(
          `/weeks/${week.id}/shopping`,
          {
            operationId: randomUUID(),
            expectedRevision: week.revision,
            key: row.key,
            fingerprint: row.fingerprint,
            checked: true,
          },
          "PUT",
        )
      ).json();
      week = (
        await write(
          `/weeks/${week.id}/meals/${week.meals[0].id}`,
          {
            operationId: randomUUID(),
            expectedRevision: week.revision,
            servings: 4,
          },
          "PATCH",
        )
      ).json();
      expect(week.shopping[0]).toMatchObject({ checked: false, review: true });
      const command = {
        operationId: randomUUID(),
        weekStart: "2026-10-05",
        current: { id: week.id, revision: week.revision },
        source: { kind: "week", id: week.id, revision: week.revision },
        servingsPolicy: "preserve",
      };
      const response = await write("/weeks", command);
      expect(response.statusCode).toBe(200);
      const next = response.json();
      expect(next.meals[0].id).not.toBe(week.meals[0].id);
      expect(next.shopping[0]).toMatchObject({ checked: false, review: false });
      expect((await write("/weeks", command)).json()).toEqual(next);
      const archived = (await app.inject(`/api/weeks/${week.id}`)).json();
      expect(archived.status).toBe("archived");
      expect(archived.shopping).toEqual(week.shopping);
      expect(
        (
          await write(`/weeks/${week.id}/meals`, {
            operationId: randomUUID(),
            expectedRevision: archived.revision,
            recipeId: recipe.id,
            servings: 2,
          })
        ).statusCode,
      ).toBe(409);
      expect(
        (await app.inject("/api/weeks?offset=0")).json().weeks,
      ).toHaveLength(1);
      expect(
        (
          await write("/weeks", {
            ...command,
            operationId: randomUUID(),
            current: { id: next.id, revision: next.revision },
          })
        ).statusCode,
      ).toBe(409);
    } finally {
      await app.close();
    }
  });

  it("copies independent templates and rejects stale template updates", async () => {
    const { app, recipe, write, create } = await setup();
    try {
      let week = await create();
      week = (
        await write(`/weeks/${week.id}/meals`, {
          operationId: randomUUID(),
          expectedRevision: week.revision,
          recipeId: recipe.id,
          servings: 2,
        })
      ).json();
      const save = {
        operationId: randomUUID(),
        name: "Usual week",
        source: { id: week.id, revision: week.revision },
      };
      const template = (await write("/templates", save)).json();
      expect(template.meals[0].snapshot.name).toBe("Test rice");
      expect(
        (await write("/templates", { ...save, operationId: randomUUID() }))
          .statusCode,
      ).toBe(409);
      expect(
        (
          await write(
            `/templates/${template.id}`,
            {
              operationId: randomUUID(),
              expectedRevision: template.revision,
              name: "Changed",
            },
            "PATCH",
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await write(
            `/templates/${template.id}`,
            {
              operationId: randomUUID(),
              expectedRevision: template.revision,
              name: "Stale",
            },
            "PATCH",
          )
        ).statusCode,
      ).toBe(409);
      week = (
        await write(
          `/weeks/${week.id}/meals/${week.meals[0].id}`,
          { operationId: randomUUID(), expectedRevision: week.revision },
          "DELETE",
        )
      ).json();
      expect(week.meals).toHaveLength(0);
      expect(
        (await app.inject(`/api/templates/${template.id}`)).json().meals,
      ).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("previews without modifying meals, validates inputs at apply and commits exactly once", async () => {
    const { app, store, write, create } = await setup();
    try {
      const week = await create();
      const preview = (
        await write(`/weeks/${week.id}/autofill/preview`, {
          expectedRevision: week.revision,
          seed: 42,
        })
      ).json();
      expect(preview.additions).toHaveLength(7);
      expect(preview.coverage).toEqual({ breakfast: 0, lunch: 0, dinner: 7 });
      expect(
        (await app.inject(`/api/weeks/${week.id}`)).json().meals,
      ).toHaveLength(0);
      store.saveHousehold({
        householdSize: 2,
        dietaryPreferences: [],
        location: "england",
      });
      expect(
        (
          await write(`/weeks/${week.id}/autofill/apply`, {
            operationId: randomUUID(),
            expectedRevision: week.revision,
            token: preview.token,
          })
        ).statusCode,
      ).toBe(409);
      const fresh = (
        await write(`/weeks/${week.id}/autofill/preview`, {
          expectedRevision: week.revision,
          seed: 42,
        })
      ).json();
      const apply = {
        operationId: randomUUID(),
        expectedRevision: week.revision,
        token: fresh.token,
      };
      const applied = (
        await write(`/weeks/${week.id}/autofill/apply`, apply)
      ).json();
      expect(applied.meals).toEqual(fresh.additions);
      expect(
        (await write(`/weeks/${week.id}/autofill/apply`, apply)).json(),
      ).toEqual(applied);
    } finally {
      await app.close();
    }
  });

  it("persists safe-integer servings and survives restart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nosh-planner-"));
    const path = join(dir, "test.sqlite");
    const { app, recipe, write, create } = await setup(path);
    let id = "";
    try {
      expect(
        (
          await write(
            "/household",
            {
              householdSize: Number.MAX_SAFE_INTEGER,
              dietaryPreferences: ["vegan"],
              location: "england",
            },
            "PUT",
          )
        ).statusCode,
      ).toBe(200);
      const week = await create();
      id = week.id;
      expect(
        (
          await write(`/weeks/${id}/meals`, {
            operationId: randomUUID(),
            expectedRevision: week.revision,
            recipeId: recipe.id,
            servings: Number.MAX_SAFE_INTEGER,
          })
        ).statusCode,
      ).toBe(200);
    } finally {
      await app.close();
    }
    const reopened = await createApp(openStore(path));
    try {
      expect(
        (await reopened.inject(`/api/weeks/${id}`)).json().meals[0].servings,
      ).toBe(Number.MAX_SAFE_INTEGER);
      expect(
        (await reopened.inject("/api/household")).json().dietaryPreferences,
      ).toEqual(["vegan"]);
    } finally {
      await reopened.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
