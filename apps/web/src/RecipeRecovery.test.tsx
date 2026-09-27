import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const card = {
  id: "soup",
  name: "Soup",
  serves: 4,
  cuisine: "british",
  tags: [],
};
const detail = {
  ...card,
  source: "user",
  mealType: ["dinner"],
  dietary: [],
  ingredients: [{ item: "beans", quantity: 100, unit: "g", prep: null }],
  method: ["Simmer."],
};
const options = { cuisines: ["british"], mealTypes: ["dinner"], tags: [] };
const household = {
  householdSize: 2,
  dietaryPreferences: [],
  location: "england",
};
function mount(
  path: string,
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function response(data: unknown, status = 200) {
  return { ok: status === 200, status, json: async () => data };
}

it("waits for household defaults and offers explicit browsing after a settings failure", async () => {
  const fetch = vi.fn(async (url: string) => {
    if (url === "/api/household") return response({}, 500);
    if (url === "/api/recipes/filter-options") return response(options);
    return response({ recipes: [card], total: 1, nextCursor: null });
  });
  vi.stubGlobal("fetch", fetch);
  mount("/recipes");
  const browse = await screen.findByRole("button", {
    name: "Browse without dietary defaults",
  });
  expect(fetch.mock.calls.some(([url]) => url.includes("catalogue"))).toBe(
    false,
  );
  fireEvent.click(browse);
  expect(await screen.findByRole("link", { name: "Soup" })).toBeInTheDocument();
});

it("keeps loaded cards when another page fails and retries that page", async () => {
  let fail = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/household") return response(household);
      if (url === "/api/recipes/filter-options") return response(options);
      if (url.includes("cursor="))
        return fail
          ? response({}, 500)
          : response({
              recipes: [{ ...card, id: "stew", name: "Stew" }],
              total: 2,
              nextCursor: null,
            });
      return response({ recipes: [card], total: 2, nextCursor: "next" });
    }),
  );
  mount("/recipes?dietary=");
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn’t load more recipes",
  );
  expect(screen.getByRole("link", { name: "Soup" })).toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry loading more" }));
  expect(await screen.findByRole("link", { name: "Stew" })).toBeInTheDocument();
});

it("sets the recipe title when opening cached details and rejects invalid serving counts", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["recipe-detail", "soup"], detail);
  client.setQueryData(["household"], household);
  mount("/recipes/soup", client);
  await waitFor(() => expect(document.title).toBe("Soup | Nosh"));
  fireEvent.change(screen.getByLabelText("Servings"), {
    target: { value: "0" },
  });
  expect(screen.getByLabelText("Servings")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByText("100 g beans")).toBeInTheDocument();
});

it("shows a not-found page", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response({}, 404)),
  );
  mount("/recipes/missing");
  expect(
    await screen.findByRole("heading", { name: "Recipe not found" }),
  ).toBeInTheDocument();
});
