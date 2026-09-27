import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { AddToWeek } from "./AddToWeek";
import { SnackbarProvider } from "./Snackbar";

afterEach(cleanup);

it.each([false, true])(
  "names the add action accessibly when showLabel is %s",
  (showLabel) => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SnackbarProvider>
            <AddToWeek recipeId="recipe-1" showLabel={showLabel} />
          </SnackbarProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Add to week" })).toBeEnabled();
  },
);
