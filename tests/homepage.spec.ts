import { expect, test } from "@playwright/test";

test("homepage, keyboard navigation and responsive layout", async ({
  page,
  request,
}) => {
  const { current } = await (await request.get("/api/planner")).json();
  const planned = current
    ? current.coverage.breakfast +
      current.coverage.lunch +
      current.coverage.dinner
    : 0;
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What’s on the menu?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article").first().getByRole("heading"),
  ).toBeVisible();
  await expect(
    page.getByText(`${planned} of 21 meal slots planned`),
  ).toBeVisible();
  await expect(
    page
      .getByRole("list", { name: "Weekly meal-plan coverage" })
      .getByRole("listitem"),
  ).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const viewMore = page.getByRole("link", { name: /View more/ });
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press("Tab");
    if (
      await viewMore.evaluate((element) => element === document.activeElement)
    )
      break;
  }
  await expect(viewMore).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/recipes$/);
  for (const [name, path] of [
    ["Meal plan", "plan"],
    ["Household", "household"],
    ["Home", ""],
  ]) {
    await page
      .getByRole("navigation", {
        name:
          page.viewportSize()!.width <= 700
            ? "Main navigation (mobile)"
            : "Main navigation",
        exact: true,
      })
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${path}$`));
  }
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
});
