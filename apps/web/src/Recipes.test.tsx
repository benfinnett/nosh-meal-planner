import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";

const card = {
  id: "soup",
  name: "Bean soup",
  cuisine: "british",
  serves: 4,
  dietary: ["vegan", "vegetarian", "gluten-free", "dairy-free"],
  tags: ["batch-cook", "freezer-friendly", "kid-friendly", "quick"],
};
const detail = {
  ...card,
  source: "system",
  mealType: ["dinner"],
  dietary: ["vegan", "vegetarian", "gluten-free", "dairy-free"],
  ingredients: [
    { item: "beans", quantity: 250, unit: "g", prep: "drained" },
    { item: "pepper", quantity: 10.5, unit: "g", prep: null },
    { item: "salt", quantity: null, unit: null, prep: null },
  ],
  method: ["Simmer the beans."],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Location() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}
function mount(path: string) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function mockApi(
  catalogue?: (url: URL) => unknown,
  create?: (body: unknown) => { ok: boolean; data: unknown },
) {
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, "http://localhost");
    let data: unknown;
    let ok = true;
    if (url.pathname === "/api/household")
      data = {
        householdSize: 3,
        dietaryPreferences: ["vegetarian"],
        location: "england",
      };
    else if (url.pathname === "/api/recipes/filter-options")
      data = {
        cuisines: ["british", "italian"],
        mealTypes: ["dinner", "dessert"],
        tags: ["quick"],
      };
    else if (url.pathname === "/api/recipes/catalogue")
      data = catalogue
        ? catalogue(url)
        : { recipes: [card], total: 1, nextCursor: null };
    else if (init?.method === "POST") {
      const result = create?.(JSON.parse(String(init.body))) ?? {
        ok: true,
        data: { ...detail, id: "custom", source: "user" },
      };
      data = result.data;
      ok = result.ok;
    } else data = detail;
    return { ok, status: ok ? 200 : 500, json: async () => data };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

it("initialises household filters, clears the dietary param on clear, and shows dietary chips before three card tags", async () => {
  const fetch = mockApi();
  mount("/recipes");
  expect(
    await screen.findByRole("link", { name: "Bean soup" }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("location")).toHaveTextContent(
    "dietary=vegetarian",
  );
  const article = screen.getByRole("article");
  const chips = within(article).getByRole("list", {
    name: "Dietary requirements and recipe tags",
  });
  expect(within(chips).getByText("Ve")).toBeInTheDocument();
  expect(within(chips).getByText("V")).toBeInTheDocument();
  expect(within(chips).getByText("GF")).toBeInTheDocument();
  expect(within(chips).getByText("DF")).toBeInTheDocument();
  expect(within(chips).queryByText("Vegan")).not.toBeInTheDocument();
  expect(chips.textContent?.indexOf("Ve")).toBeLessThan(
    chips.textContent?.indexOf("Batch cook") ?? -1,
  );
  expect(within(article).getByText("Batch cook")).toBeInTheDocument();
  expect(within(article).queryByText("Quick")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Vegan (Ve)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() =>
    expect(screen.getByTestId("location")).toHaveTextContent("/recipes"),
  );
  expect(screen.getByTestId("location")).not.toHaveTextContent("dietary");
  expect(fetch.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(
    false,
  );
});

it("honours URL filters and loads another page without losing the first", async () => {
  const fetch = mockApi((url) =>
    url.searchParams.has("cursor")
      ? {
          recipes: [{ ...card, id: "stew", name: "Bean stew" }],
          total: 2,
          nextCursor: null,
        }
      : { recipes: [card], total: 2, nextCursor: "next" },
  );
  mount("/recipes?dietary=&cuisine=british");
  await screen.findByRole("link", { name: "Bean soup" });
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  expect(
    await screen.findByRole("link", { name: "Bean stew" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Bean soup" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Load more" }),
  ).not.toBeInTheDocument();
  const urls = fetch.mock.calls
    .map(([url]) => url)
    .filter((url) => url.includes("catalogue"));
  expect(
    urls.every(
      (url) => !url.includes("vegetarian") && url.includes("cuisine=british"),
    ),
  ).toBe(true);
});

it("filters recipes to the current user's recipes", async () => {
  const fetch = mockApi((url) => ({
    recipes: url.searchParams.get("mine") === "true" ? [detail] : [card],
    total: 1,
    nextCursor: null,
  }));
  mount("/recipes?dietary=");
  await screen.findByRole("link", { name: "Bean soup" });

  fireEvent.click(screen.getByLabelText("My recipes"));

  await waitFor(() =>
    expect(fetch.mock.calls.some(([url]) => url.includes("mine=true"))).toBe(
      true,
    ),
  );
  expect(screen.getByTestId("location")).toHaveTextContent("mine=true");
});

it("scales to household and arbitrary servings, preserves null quantities, and resets", async () => {
  const fetch = mockApi();
  mount("/recipes/soup");
  await screen.findByRole("heading", { name: "Bean soup" });
  expect(
    screen.getByText(
      "Vegan (Ve), Vegetarian (V), Gluten-Free (GF), Dairy-Free (DF)",
    ),
  ).toBeInTheDocument();
  expect(screen.getByText(/250 g/)).toBeInTheDocument();
  expect(screen.getByText(/11 g pepper/)).toBeInTheDocument();
  fireEvent.click(
    await screen.findByRole("button", { name: "Use household size" }),
  );
  expect(screen.getByLabelText("Servings")).toHaveValue(3);
  expect(screen.getByText(/188 g/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Servings"), {
    target: { value: "1" },
  });
  expect(screen.getByText(/63 g beans/)).toBeInTheDocument();
  expect(screen.getByText(/2.63 g pepper/)).toBeInTheDocument();
  expect(screen.getByText("salt")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reset to original" }));
  expect(screen.getByText(/250 g/)).toBeInTheDocument();
  expect(fetch.mock.calls.every(([, init]) => !init?.method)).toBe(true);
});

it("validates creation, preserves input on failure, and saves ordered rows", async () => {
  let saved: unknown;
  let attempts = 0;
  mockApi(undefined, (body) => {
    saved = body;
    attempts += 1;
    return attempts === 1
      ? { ok: false, data: {} }
      : { ok: true, data: { ...detail, id: "custom", source: "user" } };
  });
  mount("/recipes/new");
  await waitFor(() => expect(screen.getByLabelText("Servings")).toHaveValue(3));
  fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));
  expect(await screen.findByText("Enter a recipe name.")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Recipe name"), {
    target: { value: "My soup" },
  });
  fireEvent.click(screen.getByLabelText("Dinner"));
  fireEvent.change(screen.getByLabelText("Ingredient 1"), {
    target: { value: "beans" },
  });
  fireEvent.change(screen.getByLabelText("Step 1"), {
    target: { value: "Simmer." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add step" }));
  fireEvent.change(screen.getByLabelText("Step 2"), {
    target: { value: "Drain." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Move step 2 up" }));
  fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn’t save/);
  expect(screen.getByLabelText("Recipe name")).toHaveValue("My soup");
  expect(saved).toMatchObject({
    name: "My soup",
    serves: 3,
    dietary: [],
    ingredients: [{ item: "beans", quantity: null }],
    method: ["Drain.", "Simmer."],
  });
  fireEvent.click(screen.getByRole("button", { name: "Save recipe" }));
  await waitFor(() =>
    expect(screen.getByTestId("location")).toHaveTextContent("/recipes/custom"),
  );
});
