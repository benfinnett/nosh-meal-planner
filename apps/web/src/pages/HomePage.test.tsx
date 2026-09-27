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
import HomePage from "./HomePage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(plannerResponse: () => Promise<unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json:
        url === "/api/planner"
          ? plannerResponse
          : async () => ({
              recipes: [],
              total: 0,
              nextCursor: null,
            }),
    })),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const current = {
  id: "week-1",
  weekStart: "2026-09-21",
  weekEnd: "2026-09-27",
  status: "active",
  revision: 1,
  createdAt: "2026-09-21T12:00:00Z",
  updatedAt: "2026-09-21T12:00:00Z",
  meals: [],
  shopping: [],
  coverage: { breakfast: 2, lunch: 4, dinner: 7 },
};

it("does not present unknown coverage as an empty plan while loading", () => {
  mount(() => new Promise(() => {}));
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

it("shows zero coverage when the API confirms there is no active plan", async () => {
  mount(async () => ({ current: null, suggestedWeekStart: "2026-09-28" }));
  expect(
    await screen.findByText("0 of 21 meal slots planned"),
  ).toBeInTheDocument();
  expect(screen.getByText("No active meal plan yet.")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Create a meal plan/ }),
  ).toHaveAttribute("href", "/plan");
  for (const bar of screen.getAllByRole("progressbar"))
    expect(bar).toHaveAttribute("value", "0");
});

it("allows a failed planner request to be retried without showing false zeroes", async () => {
  const response = vi
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue({ current, suggestedWeekStart: "2026-09-28" });
  mount(response);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn’t load meal-plan coverage",
  );
  expect(
    screen.queryByText("0 of 21 meal slots planned"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry meal plan" }));
  expect(
    await screen.findByText("13 of 21 meal slots planned"),
  ).toBeInTheDocument();
});

it("shows the active plan's coverage by meal type and refreshes after planner changes", async () => {
  let coverage = current.coverage;
  const client = mount(async () => ({
    current: { ...current, coverage },
    suggestedWeekStart: "2026-09-28",
  }));
  expect(
    await screen.findByText("13 of 21 meal slots planned"),
  ).toBeInTheDocument();
  const chart = screen.getByRole("list", { name: "Weekly meal-plan coverage" });
  expect(within(chart).getAllByRole("listitem")).toHaveLength(3);
  for (const [name, value] of [
    ["Breakfast", 2],
    ["Lunch", 4],
    ["Dinner", 7],
  ] as const) {
    expect(within(chart).getByRole("progressbar", { name })).toHaveAttribute(
      "value",
      String(value),
    );
    expect(within(chart).getByRole("progressbar", { name })).toHaveAttribute(
      "max",
      "7",
    );
  }
  expect(screen.getByText(/21 Sept 2026.*27 Sept 2026/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /View meal plan/ })).toHaveAttribute(
    "href",
    "/plan",
  );
  coverage = { breakfast: 3, lunch: 4, dinner: 7 };
  await client.invalidateQueries({ queryKey: ["planner"] });
  expect(
    await screen.findByText("14 of 21 meal slots planned"),
  ).toBeInTheDocument();
});
