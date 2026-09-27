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

it("shows loading and a truthful seven-day empty chart", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
  mount();
  expect(screen.getByRole("status")).toHaveTextContent("Loading recipes");
  expect(screen.getByText("0 of 21 meal slots planned")).toBeInTheDocument();
  const chart = screen.getByRole("list", { name: "Weekly meal-plan coverage" });
  expect(within(chart).getAllByRole("listitem")).toHaveLength(7);
  for (const day of within(chart).getAllByRole("listitem"))
    expect(day).toHaveAccessibleName(/0 of 3 meals planned/);
});

it("shows real summaries and navigates to the explorer and household settings", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url) => ({
      ok: true,
      json: async () =>
        url === "/api/household"
          ? { householdSize: 1, dietaryPreferences: [], location: "england" }
          : url === "/api/recipes/filter-options"
            ? { cuisines: ["british"], mealTypes: ["dinner"], tags: [] }
            : {
                total: 1,
                nextCursor: null,
                recipes: [
                  {
                    id: "r1",
                    name: "Lentil soup",
                    cuisine: "British",
                    serves: 4,
                    tags: [],
                  },
                ],
              },
    })),
  );
  mount();
  expect(await screen.findByText("Lentil soup")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View more/ })).toHaveAttribute(
    "href",
    "/recipes",
  );
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  for (const name of ["Meal plan", "Recipes", "Household"]) {
    fireEvent.click(within(nav).getByRole("link", { name }));
    expect(screen.getByRole("heading", { level: 1, name })).toBeInTheDocument();
    if (name === "Household") {
      expect(await screen.findByRole("spinbutton")).toHaveValue(1);
    } else if (name === "Meal plan") {
      expect(
        screen.getByText(/is still cooking in the kitchen/),
      ).toBeInTheDocument();
    } else {
      expect(
        screen.getByRole("link", { name: "Create recipe" }),
      ).toHaveAttribute("href", "/recipes/new");
    }
    expect(within(nav).getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});

it("explains an empty recipe response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recipes: [], total: 0, nextCursor: null }),
    }),
  );
  mount();
  expect(
    await screen.findByText("No recipes to show yet."),
  ).toBeInTheDocument();
});

it("shows a recoverable error for an invalid API response", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ recipes: [{ name: "Invalid" }] }),
    }),
  );
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn’t load recipes",
  );
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});
