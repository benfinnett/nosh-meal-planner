import { expect, test } from "@playwright/test";

test("homepage, keyboard navigation and responsive layout", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Recipe inspiration" }),
  ).toBeVisible();
  await expect(page.locator(".recipe-grid article").first()).toBeVisible();
  await expect(page.getByText("0 of 21 meal slots planned")).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Weekly meal-plan coverage" })
      .getByRole("listitem"),
  ).toHaveCount(7);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /View more/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/recipes$/);
  for (const [name, path] of [
    ["Meal plan", "meal-plan"],
    ["Household", "household"],
    ["Home", ""],
  ]) {
    await page
      .getByRole("navigation")
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
  }
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
});
