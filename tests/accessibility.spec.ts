import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function audit(page: Page, info: TestInfo, state: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  await info.attach(`${state}-axe`, {
    body: JSON.stringify(
      { violations: result.violations, incomplete: result.incomplete },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.screenshot({
    path: info.outputPath(`${state}.png`),
    fullPage: true,
  });
  expect.soft(result.violations, `${state}: axe violations`).toEqual([]);
  expect
    .soft(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `${state}: page reflows`,
    )
    .toBe(true);
}

test("settled routes, validation and unsaved dialog", async ({
  page,
}, info) => {
  for (const [path, ready] of [
    ["/", "article"],
    ["/recipes?dietary=", "article"],
    ["/household", "input[type=number]"],
    ["/plan/history", "h1"],
    ["/plan/templates", "h1"],
  ]) {
    await page.goto(path);
    await expect(page.locator(ready).first()).toBeVisible();
    await audit(page, info, path.replace(/\W/g, "_") || "home");
  }
  await page.goto("/recipes?dietary=");
  await page.getByRole("article").first().getByRole("link").click();
  await expect(page.getByLabel("Servings", { exact: true })).toBeVisible();
  await audit(page, info, "recipe-detail");
  await page.goto("/recipes/new");
  await expect(page.getByLabel("Recipe name", { exact: true })).toBeVisible();
  await audit(page, info, "create-recipe");
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
  await audit(page, info, "validation-errors");
  await page
    .getByLabel("Recipe name", { exact: true })
    .fill("Accessibility draft");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await audit(page, info, "unsaved-dialog");
  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press("Tab");
    await expect(dialog).toContainText("Keep editing");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true }),
  ).toBeFocused();
});

test("planner empty, start dialog, meals and shopping", async ({
  page,
}, info) => {
  // Context-local API responses keep this audit independent of other journeys.
  await page.route("**/api/planner", (route) =>
    route.fulfill({
      json: { current: null, suggestedWeekStart: "2026-09-28" },
    }),
  );
  await page.goto("/plan");
  const start = page.getByRole("button", { name: "Start a week", exact: true });
  await expect(start).toBeVisible();
  await audit(page, info, "empty-planner");
  await start.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await audit(page, info, "start-week-dialog");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(start).toBeFocused();
  const week = {
    id: "audit-week",
    weekStart: "2026-09-28",
    weekEnd: "2026-10-04",
    status: "active",
    revision: 1,
    createdAt: "2026-09-28T12:00:00Z",
    updatedAt: "2026-09-28T12:00:00Z",
    meals: [],
    shopping: [],
    coverage: { breakfast: 0, lunch: 0, dinner: 0 },
  };
  await page.route("**/api/planner", (route) =>
    route.fulfill({
      json: { current: week, suggestedWeekStart: "2026-10-05" },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Shopping", exact: true }),
  ).toBeVisible();
  await audit(page, info, "planner-meals");
  await page.getByRole("button", { name: "Shopping", exact: true }).click();
  await audit(page, info, "planner-shopping");
});

test("recipe loading, error and empty results", async ({ page }, info) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/recipes/catalogue?*", async (route) => {
    await pending;
    await route.fulfill({ status: 500, json: { error: "Audit failure" } });
  });
  await page.goto("/recipes?dietary=");
  await expect(
    page.getByRole("status").filter({ hasText: /Loading recipes/ }),
  ).toBeVisible();
  await audit(page, info, "loading-recipes");
  release();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 15000 });
  await audit(page, info, "recipe-error");
  await page.route("**/api/recipes/catalogue?*", (route) =>
    route.fulfill({ json: { recipes: [], total: 0, nextCursor: null } }),
  );
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: /Loading recipes/ }),
  ).toHaveCount(0);
  await audit(page, info, "empty-recipes");
});
