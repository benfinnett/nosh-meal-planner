import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { PlannedMeal } from "@nosh/contracts";
import { MealCollection } from "./MealPlanComponents";

vi.mock("./RecipeDetailPage", () => ({
  RecipeContent: () => <p>Captured recipe body</p>,
}));

afterEach(cleanup);

const meal = {
  id: "meal-1",
  sourceRecipeId: "recipe-1",
  snapshot: {
    id: "recipe-1",
    name: "Lentil soup",
    cuisine: "British",
    serves: 4,
    dietary: [],
    tags: [],
    source: "system",
    mealType: ["dinner"],
    ingredients: [],
    method: [],
    version: 1,
  },
  servings: 2,
  order: 0,
} as PlannedMeal;

it("opens the recipe from the meal card", () => {
  render(<MealCollection meals={[meal]} editable busy={false} />);

  fireEvent.click(
    screen.getByRole("button", { name: "View recipe Lentil soup" }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent("Captured recipe body");
});

it("provides serving steppers bounded to valid positive integers", () => {
  render(
    <MealCollection
      meals={[meal]}
      editable
      busy={false}
      change={vi.fn().mockResolvedValue(true)}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Change servings" }));
  const servingsInput = screen.getByRole("spinbutton", { name: "Servings" });
  const decrease = screen.getByRole("button", { name: "Decrease servings" });
  const increase = screen.getByRole("button", { name: "Increase servings" });

  fireEvent.click(decrease);
  expect(servingsInput).toHaveValue(1);
  expect(decrease).toBeDisabled();
  fireEvent.click(increase);
  expect(servingsInput).toHaveValue(2);
});

it("marks the remove action as destructive without exposing a view action button", () => {
  render(<MealCollection meals={[meal]} editable busy={false} />);

  expect(
    screen.queryByRole("button", { name: /^View recipe$/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove" })).toHaveAttribute(
    "data-variant",
    "text-error",
  );
});
