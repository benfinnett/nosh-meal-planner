import React from "react";
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
import { App } from "./App";

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
  expect(screen.getByText("Loading recipes…")).toBeInTheDocument();
  expect(screen.getByText("0 of 21 meal slots planned")).toBeInTheDocument();
  const chart = screen.getByRole("list", { name: "Weekly meal-plan coverage" });
  expect(within(chart).getAllByRole("listitem")).toHaveLength(7);
  for (const day of within(chart).getAllByRole("listitem"))
    expect(day).toHaveAccessibleName(/0 of 3 meals planned/);
});

it("shows real summaries and navigates to each explicit placeholder", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          recipes: [
            { id: "r1", name: "Lentil soup", cuisine: "British", serves: 4 },
          ],
        }),
      }),
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
    expect(screen.getByText(/isn’t available yet/)).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
});

it("explains an empty recipe response", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ recipes: [] }) }),
  );
  mount();
  expect(
    await screen.findByText("No recipes to show yet."),
  ).toBeInTheDocument();
});

it("shows a recoverable error for an invalid API response", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
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
