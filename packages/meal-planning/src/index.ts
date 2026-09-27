export interface Snapshot {
  version: 1;
  id: string;
  name: string;
  serves: number;
  source: "system" | "user";
  cuisine: string;
  mealType: string[];
  dietary: string[];
  tags: string[];
  method: string[];
  ingredients: {
    item: string;
    quantity: number | null;
    unit: string | null;
    prep: string | null;
  }[];
}

export interface Meal {
  id: string;
  sourceRecipeId: string;
  snapshot: Snapshot;
  servings: number;
  order: number;
}

export interface Rational {
  numerator: string;
  denominator: string;
}
export interface Attribution {
  occurrenceId: string;
  recipeName: string;
  position: number;
  prep: string | null;
  servings: number;
}
export interface Requirement {
  key: string;
  label: string;
  fingerprint: string;
  components: {
    unit: string | null;
    quantity: Rational | null;
    unknown: number;
    display: string;
    suggested: string | null;
    attribution: Attribution[];
  }[];
  attribution: Attribution[];
}
export interface Override {
  key: string;
  checked: boolean;
  fingerprint: string;
  review: boolean;
}

function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use YYYY-MM-DD.");
  const result = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(result.getTime()) ||
    result.toISOString().slice(0, 10) !== value
  )
    throw new Error("Choose a valid calendar date.");
  return result;
}
export function monday(value: string) {
  try {
    return date(value).getUTCDay() === 1;
  } catch {
    return false;
  }
}
export function addDays(value: string, days: number) {
  const result = date(value);
  result.setUTCDate(result.getUTCDate() + days);
  const output = result.toISOString().slice(0, 10);
  date(output);
  return output;
}
export function suggestedMonday(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return addDays(today, -((date(today).getUTCDay() + 6) % 7));
}
function safeServings(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("Servings must be a positive safe whole number.");
}

type Fraction = [bigint, bigint];
function fraction(n: bigint, d: bigint): Fraction {
  let a = n,
    b = d;
  while (b) [a, b] = [b, a % b];
  return [n / a, d / a];
}
function decimal(value: number): Fraction {
  if (!Number.isFinite(value) || value < 0)
    throw new Error("Recipe contains an invalid ingredient quantity.");
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const [whole, decimals = ""] = mantissa.split(".");
  const power = Number(exponent) - decimals.length;
  return fraction(
    BigInt(whole + decimals) * 10n ** BigInt(Math.max(0, power)),
    10n ** BigInt(Math.max(0, -power)),
  );
}
function plus(a: Fraction, b: Fraction): Fraction {
  return fraction(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
}
function dto([numerator, denominator]: Fraction): Rational {
  return { numerator: String(numerator), denominator: String(denominator) };
}
export function formatQuantity(value: Rational, unit: string | null) {
  const n = BigInt(value.numerator);
  let d = BigInt(value.denominator);
  if ((unit === "g" || unit === "ml") && n >= 1000n * d) {
    d *= 1000n;
    unit = unit === "g" ? "kg" : "l";
  }
  const suffix = unit ? ` ${unit}` : "";
  if (n > 0n && n * 100n < d) return `<0.01${suffix}`;
  const rounded = (n * 100n + d / 2n) / d;
  const digits = (rounded % 100n)
    .toString()
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${(n * 100n) % d ? "≈" : ""}${rounded / 100n}${digits ? `.${digits}` : ""}${suffix}`;
}

const normalise = (text: string) =>
  text.trim().replace(/\s+/g, " ").toLowerCase();
// Basic English pluralisation stemming, e.g. "apples" and "apple" share a stem.
function singular(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (/(xes|ses|zes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}
const aliases: Record<string, string> = {
  scallion: "spring onion",
  scallions: "spring onion",
  "spring onions": "spring onion",
  egg: "eggs",
  onion: "onions",
  tomato: "tomatoes",
};
const units: Record<string, [string, number]> = {
  g: ["g", 1],
  gram: ["g", 1],
  grams: ["g", 1],
  kg: ["g", 1000],
  kilogram: ["g", 1000],
  kilograms: ["g", 1000],
  ml: ["ml", 1],
  millilitre: ["ml", 1],
  millilitres: ["ml", 1],
  l: ["ml", 1000],
  litre: ["ml", 1000],
  litres: ["ml", 1000],
  tin: ["tin", 1],
  tins: ["tin", 1],
  handful: ["handful", 1],
  handfuls: ["handful", 1],
  clove: ["clove", 1],
  cloves: ["clove", 1],
  slice: ["slice", 1],
  slices: ["slice", 1],
  rasher: ["rasher", 1],
  rashers: ["rasher", 1],
};
const countableUnits = new Set(["tin", "clove", "slice", "rasher"]);
const countableItems = new Set([
  "eggs",
  "onions",
  "tomatoes",
  "spring onion",
  "pork sausages",
  "lemons",
  "limes",
  "carrots",
  "potatoes",
]);

export function aggregate(meals: Meal[]): Requirement[] {
  const rows = new Map<
    string,
    {
      labels: Map<string, number>;
      components: Map<
        string,
        {
          unit: string | null;
          sum: Fraction | null;
          unknown: number;
          attribution: Attribution[];
        }
      >;
    }
  >();
  for (const meal of meals) {
    safeServings(meal.servings);
    safeServings(meal.snapshot.serves);
    meal.snapshot.ingredients.forEach((ingredient, position) => {
      const name = normalise(ingredient.item),
        identity = aliases[name] ?? name,
        stem = singular(identity);
      const key = `v1:${stem}`;
      const rawUnit = ingredient.unit ? normalise(ingredient.unit) : "";
      const [unit, factor] = units[rawUnit] ?? [rawUnit || null, 1];
      const row = rows.get(key) ?? { labels: new Map(), components: new Map() };
      row.labels.set(identity, (row.labels.get(identity) ?? 0) + 1);
      const component = row.components.get(unit ?? "") ?? {
        unit,
        sum: null,
        unknown: 0,
        attribution: [],
      };
      if (ingredient.quantity === null) component.unknown++;
      else {
        const [n, d] = decimal(ingredient.quantity);
        const scaled = fraction(
          n * BigInt(meal.servings) * BigInt(factor),
          d * BigInt(meal.snapshot.serves),
        );
        component.sum = component.sum ? plus(component.sum, scaled) : scaled;
      }
      component.attribution.push({
        occurrenceId: meal.id,
        recipeName: meal.snapshot.name,
        position,
        prep: ingredient.prep,
        servings: meal.servings,
      });
      row.components.set(unit ?? "", component);
      rows.set(key, row);
    });
  }
  return [...rows]
    .map(([key, row]) => {
      // Prefer the most commonly used spelling, breaking ties alphabetically for stability.
      const label = [...row.labels].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      )[0][0];
      const components = [...row.components.values()]
        .sort((a, b) => (a.unit ?? "").localeCompare(b.unit ?? ""))
        .map((c) => ({
          unit: c.unit,
          quantity: c.sum ? dto(c.sum) : null,
          unknown: c.unknown,
          display: [
            c.sum ? formatQuantity(dto(c.sum), c.unit) : "",
            c.unknown ? "Amount not specified" : "",
          ]
            .filter(Boolean)
            .join(" + "),
          suggested:
            c.sum &&
            !c.unknown &&
            (c.unit ? countableUnits.has(c.unit) : countableItems.has(label))
              ? String((c.sum[0] + c.sum[1] - 1n) / c.sum[1])
              : null,
          attribution: c.attribution,
        }));
      // Canonical exact requirements, not recipe metadata or display rounding.
      const fingerprint = `v1:${JSON.stringify(components.map((c) => [c.unit, c.quantity, c.unknown]))}`;
      return {
        key,
        label,
        components,
        attribution: components.flatMap((c) => c.attribution),
        fingerprint,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function reconcile(
  rows: Requirement[],
  overrides: Override[],
): Override[] {
  return rows.flatMap((row) => {
    const previous = overrides.find((o) => o.key === row.key);
    if (!previous) return [];
    if (previous.fingerprint === row.fingerprint) return [previous];
    return [
      {
        key: row.key,
        fingerprint: row.fingerprint,
        checked: false,
        review: previous.checked || previous.review,
      },
    ];
  });
}

export const categories = ["breakfast", "lunch", "dinner"] as const;
export type Coverage = Record<(typeof categories)[number], number>;
export function coverage(meals: Meal[]): Coverage {
  const ordered = [...meals].sort((a, b) => a.order - b.order);
  const assigned = Array<number>(21).fill(-1);
  function place(index: number, visited: Set<number>): boolean {
    for (let position = 0; position < 21; position++) {
      if (
        visited.has(position) ||
        !ordered[index].snapshot.mealType.includes(
          categories[Math.floor(position / 7)],
        )
      )
        continue;
      visited.add(position);
      if (assigned[position] < 0 || place(assigned[position], visited)) {
        assigned[position] = index;
        return true;
      }
    }
    return false;
  }
  ordered.forEach((_, index) => place(index, new Set()));
  return {
    breakfast: assigned.slice(0, 7).filter((n) => n >= 0).length,
    lunch: assigned.slice(7, 14).filter((n) => n >= 0).length,
    dinner: assigned.slice(14).filter((n) => n >= 0).length,
  };
}

function surplus(rows: Requirement[]) {
  return rows.reduce(
    (sum, row) =>
      sum +
      row.components.reduce((part, c) => {
        if (!c.suggested || !c.quantity) return part;
        const d = BigInt(c.quantity.denominator);
        const remainder = (d - (BigInt(c.quantity.numerator) % d)) % d;
        // Only a bounded ratio enters the heuristic; exact totals never become floats.
        return part + Number((remainder * 1000000n) / d) / 1000000;
      }, 0),
    0,
  );
}

export const algorithmVersion = 1;
/**
 * Greedily fills uncovered meal slots using eligible catalogue recipes.
 * Candidates must match every requested dietary tag and have valid ingredients.
 * Scoring favors ingredient overlap and whole countable quantities, while
 * penalizing repeated recipes; the seed selects among the five best candidates.
 * Stops when every meal type has seven slots covered or no candidate improves
 * coverage. Inputs are left unchanged.
 *
 * @returns The added meals and the resulting breakfast, lunch, and dinner coverage.
 */
export function autofill(
  existing: Meal[],
  catalogue: Snapshot[],
  servings: number,
  dietary: string[],
  seed: number,
) {
  safeServings(servings);
  let randomState = seed >>> 0;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }
  const eligible = catalogue.filter((snapshot) => {
    if (
      !categories.some((type) => snapshot.mealType.includes(type)) ||
      !dietary.every((p) => snapshot.dietary.includes(p))
    )
      return false;
    try {
      aggregate([
        {
          id: "validate",
          sourceRecipeId: snapshot.id,
          snapshot,
          servings,
          order: 0,
        },
      ]);
      return true;
    } catch {
      return false;
    }
  });
  const additions: Meal[] = [];
  let meals = [...existing];
  let counts = coverage(meals);
  while (categories.some((type) => counts[type] < 7)) {
    const currentRows = aggregate(meals);
    const currentKeys = new Set(currentRows.map((row) => row.key));
    const currentSurplus = surplus(currentRows);
    const scored = eligible
      .flatMap((snapshot) => {
        const candidate: Meal = {
          id: `autofill-${seed}-${additions.length}`,
          sourceRecipeId: snapshot.id,
          snapshot,
          servings,
          order: Math.max(-1, ...meals.map((m) => m.order)) + 1,
        };
        const next = coverage([...meals, candidate]);
        const improved = categories.filter((type) => next[type] > counts[type]);
        if (!improved.length) return [];
        const rows = aggregate([candidate]);
        const overlap = rows.length
          ? rows.filter((row) => currentKeys.has(row.key)).length / rows.length
          : 0;
        const wholeImprovement = Math.max(
          -1,
          Math.min(
            1,
            currentSurplus - surplus(aggregate([...meals, candidate])),
          ),
        );
        const repeats = meals.filter(
          (m) => m.sourceRecipeId === snapshot.id,
        ).length;
        const penalty = improved.some((type) => type !== "dinner") ? 0.5 : 2;
        return [
          {
            candidate,
            next,
            score: 3 * overlap + wholeImprovement - penalty * repeats,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.candidate.sourceRecipeId.localeCompare(b.candidate.sourceRecipeId),
      );
    if (!scored.length) break;
    const chosen = scored[Math.floor(random() * Math.min(5, scored.length))];
    additions.push(chosen.candidate);
    meals = [...meals, chosen.candidate];
    counts = chosen.next;
  }
  return { additions, coverage: counts };
}
