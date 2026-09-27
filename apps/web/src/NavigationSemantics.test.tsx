import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

const household = {
  householdSize: 2,
  dietaryPreferences: ["vegetarian"],
  location: "england",
};
const recipe = {
  id: "soup",
  name: "Bean soup",
  cuisine: "british",
  serves: 4,
  dietary: ["vegetarian"],
  tags: [],
  source: "system",
  mealType: ["dinner"],
  ingredients: [{ item: "beans", quantity: 100, unit: "g", prep: null }],
  method: ["Simmer."],
};
const week = {
  id: "week-1",
  weekStart: "2026-09-21",
  weekEnd: "2026-09-27",
  status: "active",
  revision: 1,
  createdAt: "2026-09-21T12:00:00Z",
  updatedAt: "2026-09-21T12:00:00Z",
  meals: [],
  shopping: [],
  coverage: { breakfast: 0, lunch: 0, dinner: 0 },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

function mount(
  path: string,
  cachedHousehold = false,
  loadHousehold = async () => household,
) {
  const error = vi.spyOn(console, "error");
  const warn = vi.spyOn(console, "warn");
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    let data: unknown;
    switch (url.pathname) {
      case "/api/household":
        data = await loadHousehold();
        break;
      case "/api/recipes/filter-options":
        data = { cuisines: ["british"], mealTypes: ["dinner"], tags: [] };
        break;
      case "/api/recipes/catalogue":
        data = { recipes: [recipe], total: 1, nextCursor: null };
        break;
      case "/api/recipes/soup":
        data = recipe;
        break;
      case "/api/planner":
        data = { current: week, suggestedWeekStart: "2026-09-28" };
        break;
      case "/api/templates":
        data = { templates: [] };
        break;
      case "/api/weeks":
        data = {
          weeks: [
            {
              ...week,
              status: "archived",
              mealCount: 0,
            },
          ],
          nextOffset: null,
        };
        break;
      default:
        throw new Error(`Unexpected request: ${url.pathname}`);
    }
    return { ok: true, json: async () => data };
  });
  vi.stubGlobal("fetch", fetch);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (cachedHousehold) client.setQueryData(["household"], household);
  render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <App />
          <Location />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
  return { fetch, error, warn };
}

it.each([false, true])(
  "initialises dietary defaults without render-time navigation (cached: %s)",
  async (cached) => {
    let resolveHousehold!: (value: typeof household) => void;
    const pending = new Promise<typeof household>((resolve) => {
      resolveHousehold = resolve;
    });
    const { fetch, error, warn } = mount(
      "/recipes?cuisine=british",
      cached,
      () => pending,
    );
    if (!cached) {
      expect(fetch.mock.calls.some(([url]) => url.includes("catalogue"))).toBe(
        false,
      );
      await act(async () => resolveHousehold(household));
    }
    await screen.findByRole("link", { name: "Bean soup" });
    expect(screen.getByTestId("location")).toHaveTextContent(
      "cuisine=british&dietary=vegetarian",
    );
    const catalogueCalls = fetch.mock.calls.filter(([url]) =>
      url.includes("catalogue"),
    );
    expect(catalogueCalls.length).toBeGreaterThan(0);
    expect(
      catalogueCalls.every(
        ([url]) =>
          new URL(url, "http://localhost").searchParams
            .getAll("dietary")
            .join() === "vegetarian",
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/recipes$/),
    );
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  },
);
