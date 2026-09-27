import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "@/App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockApi(catalogue: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      let data: unknown;
      if (url === "/api/planner") {
        data = { current: null, suggestedWeekStart: "2026-09-28" };
      } else if (url === "/api/templates") {
        data = { templates: [] };
      } else if (url === "/api/household") {
        data = {
          householdSize: 1,
          dietaryPreferences: [],
          location: "england",
        };
      } else if (url === "/api/recipes/filter-options") {
        data = { cuisines: ["british"], mealTypes: ["dinner"], tags: [] };
      } else if (url.startsWith("/api/recipes/catalogue?")) {
        data = catalogue;
      } else {
        throw new Error(`Unexpected request: ${url}`);
      }
      return { ok: true, json: async () => data };
    }),
  );
}

it("shows loading without claiming the meal plan is empty", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  mount();
  expect(
    screen
      .getAllByRole("status")
      .some((status) => status.textContent?.includes("Loading recipes")),
  ).toBe(true);
  expect(screen.getByText("Loading meal plan…")).toHaveAttribute(
    "role",
    "status",
  );
  expect(
    screen.queryByText("0 of 21 meal slots planned"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("list", { name: "Weekly meal-plan coverage" }),
  ).not.toBeInTheDocument();
});

it("shows real summaries and navigates to the explorer and household settings", async () => {
  mockApi({
    total: 1,
    nextCursor: null,
    recipes: [
      {
        id: "r1",
        name: "Lentil soup",
        cuisine: "British",
        serves: 4,
        dietary: [],
        tags: [],
      },
    ],
  });
  mount();
  expect(await screen.findByText("Lentil soup")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View more/ })).toHaveAttribute(
    "href",
    "/recipes",
  );
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  for (const name of ["Meal plan", "Recipes", "Household"]) {
    fireEvent.click(within(nav).getByRole("link", { name }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: name === "Meal plan" ? "Plan your week" : name,
      }),
    ).toBeInTheDocument();
    if (name === "Household") {
      expect(await screen.findByRole("spinbutton")).toHaveValue(1);
    } else if (name === "Meal plan") {
      expect(
        screen.getByRole("button", { name: "Start a week" }),
      ).toBeInTheDocument();
    } else {
      for (const link of screen.getAllByRole("link", {
        name: "Create recipe",
      })) {
        expect(link).toHaveAttribute("href", "/recipes/new");
      }
    }
    expect(within(nav).getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});

it("explains an empty recipe response", async () => {
  mockApi({ recipes: [], total: 0, nextCursor: null });
  mount();
  expect(
    await screen.findByText("No recipes to show yet."),
  ).toBeInTheDocument();
});

it("shows a recoverable error for an invalid API response", async () => {
  mockApi({ recipes: [{ name: "Invalid" }] });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn’t load recipes",
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});
