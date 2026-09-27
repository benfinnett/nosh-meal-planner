import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";

const initial = {
  householdSize: 1,
  dietaryPreferences: [],
  location: "england",
};

function mockHouseholdApi(save: (options: RequestInit) => unknown) {
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/household") {
      if (options?.method === "PUT") return save(options);
      return { ok: true, json: async () => initial };
    }
    if (url === "/api/planner") {
      return {
        ok: true,
        json: async () => ({ current: null, suggestedWeekStart: "2026-09-28" }),
      };
    }
    if (url === "/api/templates") {
      return { ok: true, json: async () => ({ templates: [] }) };
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/household"]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shows a skeleton without editable defaults, then recovers from a loading failure", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ ok: true, json: async () => initial });
  vi.stubGlobal("fetch", fetch);
  mount();
  expect(screen.getByRole("status")).toHaveTextContent(
    "Loading household settings",
  );
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.queryByText("NHS Healthy Start")).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("spinbutton")).toHaveValue(1);
  expect(screen.getByRole("combobox")).toHaveValue("england");
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("debounces edits, serializes saves, preserves newer drafts and retries failures across navigation", async () => {
  vi.useFakeTimers();
  let finish!: (value: unknown) => void;
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(async (options) => ({
      ok: true,
      json: async () => JSON.parse(options.body),
    }));
  const fetch = mockHouseholdApi(save);
  mount();
  await tick();
  await tick(1);
  const size = screen.getByRole("spinbutton");
  fireEvent.change(size, { target: { value: "2" } });
  await tick(400);
  fireEvent.change(size, { target: { value: "3" } });
  await tick(599);
  expect(fetch).toHaveBeenCalledTimes(1);
  await tick(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  fireEvent.change(size, { target: { value: "4" } });
  await tick(600);
  expect(fetch).toHaveBeenCalledTimes(2);
  await act(async () =>
    finish({ ok: true, json: async () => ({ ...initial, householdSize: 3 }) }),
  );
  await tick();
  expect(size).toHaveValue(4);
  expect(screen.getByRole("status")).toHaveTextContent("Couldn’t save");
  const bottomNav = screen.getByRole("navigation", {
    name: "Main navigation (mobile)",
  });
  fireEvent.click(within(bottomNav).getByRole("link", { name: "Meal plan" }));
  fireEvent.click(within(bottomNav).getByRole("link", { name: "Household" }));
  expect(screen.getByRole("spinbutton")).toHaveValue(4);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await tick();
  expect(screen.getByRole("status")).toHaveTextContent("Saved");
  const saves = fetch.mock.calls.filter(
    ([url, options]) => url === "/api/household" && options?.method === "PUT",
  );
  expect(saves).toHaveLength(3);
  expect(JSON.parse(saves.at(-1)![1]!.body as string).householdSize).toBe(4);
});

it("cancels invalid pending edits and keeps saving after navigating away", async () => {
  vi.useFakeTimers();
  const fetch = mockHouseholdApi(async (options) => ({
    ok: true,
    json: async () => JSON.parse(options.body as string),
  }));
  mount();
  await tick();
  await tick(1);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5" } });
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
  await tick(600);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("spinbutton")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "6" } });
  const bottomNav = screen.getByRole("navigation", {
    name: "Main navigation (mobile)",
  });
  fireEvent.click(within(bottomNav).getByRole("link", { name: "Meal plan" }));
  await tick(600);
  fireEvent.click(within(bottomNav).getByRole("link", { name: "Household" }));
  expect(screen.getByRole("spinbutton")).toHaveValue(6);
  expect(screen.getByRole("status")).toHaveTextContent("Saved");
});

it("supports combined preferences and all location-specific information", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => initial }),
  );
  mount();
  await screen.findByRole("spinbutton");
  for (const label of ["Vegetarian", "Vegan", "Dairy-free", "Gluten-free"]) {
    fireEvent.click(screen.getByLabelText(label));
    expect(screen.getByLabelText(label)).toBeChecked();
  }
  for (const location of ["england", "wales", "northern-ireland"]) {
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: location },
    });
    expect(
      screen.getByRole("link", { name: /Find out about NHS Healthy Start/ }),
    ).toHaveAttribute("href", "https://www.healthystart.nhs.uk/");
    expect(
      screen.getByRole("link", { name: /Find out about NHS Healthy Start/ }),
    ).toHaveAttribute("target", "_blank");
  }
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "scotland" },
  });
  expect(
    screen.getByRole("link", { name: /Find out about Best Start Foods/ }),
  ).toHaveAttribute(
    "href",
    "https://www.mygov.scot/best-start-grant-best-start-foods",
  );
  expect(
    screen.getByRole("link", { name: /Find out about Best Start Foods/ }),
  ).toHaveAttribute("target", "_blank");
  for (const location of ["outside-uk", "unspecified"]) {
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: location },
    });
    expect(
      screen.queryByRole("heading", {
        name: /NHS Healthy Start|Best Start Foods/,
      }),
    ).not.toBeInTheDocument();
  }
});
