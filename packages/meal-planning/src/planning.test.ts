import { describe, expect, it } from "vitest";
import {
  aggregate,
  reconcile,
  monday,
  addDays,
  formatQuantity,
  coverage,
  autofill,
  type Meal,
  type Snapshot,
} from "./index.js";

function meal(
  id: string,
  quantity: number | null = 300,
  unit: string | null = "g",
): Meal {
  return {
    id,
    sourceRecipeId: "rice",
    servings: 2,
    order: 0,
    snapshot: {
      version: 1,
      id: "rice",
      name: "Rice",
      serves: 4,
      cuisine: "",
      source: "system",
      mealType: ["dinner"],
      dietary: [],
      tags: [],
      method: ["Cook"],
      ingredients: [{ item: " Rice ", quantity, unit, prep: "rinsed" }],
    },
  };
}

describe("weekly collections", () => {
  it("validates Mondays and handles year and leap boundaries", () => {
    expect(monday("2026-09-28")).toBe(true);
    expect(monday("2026-09-27")).toBe(false);
    expect(monday("2026-02-30")).toBe(false);
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2024-02-26", 7)).toBe("2024-03-04");
  });
  it("maximises coverage without counting multi-type meals twice", () => {
    const flexible = Array.from({ length: 7 }, (_, i) => ({
      ...meal(`f${i}`),
      snapshot: { ...meal("x").snapshot, mealType: ["lunch", "dinner"] },
    }));
    const lunches = Array.from({ length: 7 }, (_, i) => ({
      ...meal(`l${i}`),
      snapshot: { ...meal("x").snapshot, mealType: ["lunch"] },
    }));
    expect(coverage(flexible)).toEqual({ breakfast: 0, lunch: 7, dinner: 0 });
    expect(coverage([...flexible, ...lunches])).toEqual({
      breakfast: 0,
      lunch: 7,
      dinner: 7,
    });
  });
});

describe("exact shopping requirements", () => {
  it("scales and sums before formatting, including duplicate meals once each", () => {
    const second = meal("b", 0.2, "kg");
    second.servings = 4;
    const [row] = aggregate([meal("a"), second]);
    expect(row.components[0].quantity).toEqual({
      numerator: "350",
      denominator: "1",
    });
    expect(row.components[0].display).toBe("350 g");
    const third = meal("c", 1);
    third.snapshot.serves = 3;
    third.servings = 1;
    expect(
      aggregate([third, { ...third, id: "d" }, { ...third, id: "e" }])[0]
        .components[0].display,
    ).toBe("1 g");
    expect(formatQuantity({ numerator: "1", denominator: "1000" }, "g")).toBe(
      "<0.01 g",
    );
  });
  it("retains incompatible units, unknowns and zero; ignores preparation for identity", () => {
    const meals = [
      meal("a", 0, "grams"),
      meal("b", null, "g"),
      meal("c", 1, "tin"),
      meal("d", 10, "ml"),
      meal("e", 1, "handful"),
      meal("f", 1, null),
    ];
    meals[1].snapshot.ingredients[0].prep = "chopped";
    const [row] = aggregate(meals);
    expect(row.key).toBe("v1:rice");
    expect(row.components).toHaveLength(5);
    expect(row.components.find((c) => c.unit === "g")).toMatchObject({
      quantity: { numerator: "0", denominator: "1" },
      unknown: 1,
    });
    expect(row.attribution).toHaveLength(6);
  });
  it("preserves checks for equal requirements, resets changes and forgets removed rows", () => {
    const a = meal("a");
    const before = aggregate([a]);
    const sameNeed = meal("b", 150);
    sameNeed.servings = 4;
    sameNeed.snapshot.name = "Another meal";
    expect(aggregate([sameNeed])[0].fingerprint).toBe(before[0].fingerprint);
    const overrides = [
      {
        key: before[0].key,
        checked: true,
        fingerprint: before[0].fingerprint,
        review: false,
      },
    ];
    expect(reconcile(aggregate([sameNeed]), overrides)[0].checked).toBe(true);
    expect(
      reconcile(aggregate([a, { ...a, id: "b" }]), overrides)[0],
    ).toMatchObject({ checked: false, review: true });
    expect(reconcile([], overrides)).toEqual([]);
    expect(reconcile(before, reconcile([], overrides))).toEqual([]);
    expect(aggregate([meal("a", 300.00001)])[0].fingerprint).not.toBe(
      before[0].fingerprint,
    );
  });
  it("rounds only combined known countable amounts, never guessed unitless amounts", () => {
    const eggs = meal("a", 5, null);
    eggs.snapshot.ingredients[0].item = "eggs";
    expect(aggregate([eggs])[0].components[0]).toMatchObject({
      display: "2.5",
      suggested: "3",
    });
    expect(
      aggregate([eggs, { ...eggs, id: "b" }])[0].components[0].suggested,
    ).toBe("5");
    expect(
      aggregate([meal("a", 5, null)])[0].components[0].suggested,
    ).toBeNull();
  });
  it("rejects invalid quantities and supports safe servings without overflow", () => {
    expect(() => aggregate([meal("a", -1)])).toThrow();
    const a = meal("a", 1e300);
    a.servings = Number.MAX_SAFE_INTEGER;
    expect(aggregate([a])[0].components[0].display).not.toMatch(/Infinity|NaN/);
    a.snapshot.serves = 0;
    expect(() => aggregate([a])).toThrow();
  });
  it("fuzzily merges singular and plural spellings of the same item", () => {
    const apple = meal("a", 2, null);
    apple.snapshot.ingredients[0].item = "Apple";
    const apples = meal("b", 3, null);
    apples.snapshot.ingredients[0].item = "apples";
    const rows = aggregate([apple, apples]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("apple");
    expect(rows[0].attribution).toHaveLength(2);
  });
});

describe("seeded autofill", () => {
  it("keeps excess dinners, fills other types and strictly applies dietary filters", () => {
    const existing = Array.from({ length: 9 }, (_, i) => meal(String(i)));
    const catalogue: Snapshot[] = ["breakfast", "lunch", "dinner"].map(
      (type) => ({
        ...meal(type).snapshot,
        id: type,
        mealType: [type],
        dietary: ["vegan"],
      }),
    );
    catalogue.push({ ...catalogue[0], id: "unsuitable", dietary: [] });
    const before = JSON.stringify(existing);
    const result = autofill(existing, catalogue, 2, ["vegan"], 42);
    expect(result.additions).toHaveLength(14);
    expect(result.coverage).toEqual({ breakfast: 7, lunch: 7, dinner: 7 });
    expect(
      result.additions.every((m) => m.snapshot.dietary.includes("vegan")),
    ).toBe(true);
    expect(result.additions.every((m) => m.servings === 2)).toBe(true);
    expect(JSON.stringify(existing)).toBe(before);
    expect(autofill(existing, catalogue, 2, ["vegan"], 42)).toEqual(result);
    expect(autofill(existing, catalogue, 2, ["gluten-free"], 42)).toMatchObject(
      { additions: [], coverage: { breakfast: 0, lunch: 0, dinner: 7 } },
    );
  });
});
