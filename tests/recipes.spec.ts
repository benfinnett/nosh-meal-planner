import { expect, test } from "@playwright/test";

test("explorer restores filters, loaded pages and focus after recipe details", async ({
  page,
  request,
}) => {
  const total = (await (await request.get("/api/recipes/catalogue")).json())
    .total;
  await page.goto("/recipes?dietary=");
  await expect(page.getByRole("article")).toHaveCount(12);
  await page
    .getByRole("button", { name: "Load more", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(page.getByRole("article")).toHaveCount(total);
  const card = page.getByRole("article").nth(15).getByRole("link");
  const name = await card.innerText();
  await card.click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page).toHaveTitle(`${name} | Nosh`);
  await page.getByLabel("Servings", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Back to recipes" }).click();
  await expect(page).toHaveURL(/\/recipes\?dietary=$/);
  await expect(page.getByRole("article")).toHaveCount(total);
  await expect(page.getByRole("link", { name, exact: true })).toBeFocused();
  await page.getByLabel("Search recipes").fill("porridge");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page).toHaveURL(/q=porridge/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/recipes-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("creates a persistent recipe with scaling and protects an unsaved draft", async ({
  page,
}) => {
  const name = `Test soup ${test.info().project.name} ${Date.now()}`;
  await page.goto("/recipes/new");
  await page.getByLabel("Recipe name", { exact: true }).fill(name);
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Recipe name", { exact: true })).toHaveValue(
    name,
  );
  await page.getByLabel("Base servings", { exact: true }).fill("4");
  await page.getByLabel("Dinner", { exact: true }).check();
  await page.getByLabel("Ingredient 1", { exact: true }).fill("beans");
  await page.getByLabel("Quantity 1", { exact: true }).fill("250");
  await page.getByLabel("Unit 1", { exact: true }).fill("g");
  await page.getByLabel("Step 1", { exact: true }).fill("Simmer the beans.");
  await page.screenshot({
    path: `test-results/create-recipe-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save recipe", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.reload();
  await expect(page.getByText("250 g beans", { exact: true })).toBeVisible();
  await page.getByLabel("Servings", { exact: true }).fill("3");
  await expect(page.getByText("187.5 g beans", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/recipe-detail-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto(`/recipes?dietary=&q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
});

test("mobile filters remain usable with reduced motion and a keyboard", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "laptop", "Mobile filter sheet");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/recipes?dietary=");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Dessert", { exact: true }).check();
  await dialog.getByRole("button", { name: "Show recipes" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/mealType=dessert/);
  await expect(
    page.getByRole("button", { name: "Remove Dessert filter" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Dessert filter" }).click();
  await expect(page).not.toHaveURL(/mealType/);
});
