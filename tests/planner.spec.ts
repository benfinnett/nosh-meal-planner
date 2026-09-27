import { expect, test } from "@playwright/test";

test("plans a collection, shops, saves a template and reuses archived history", async ({
  page,
  request,
}) => {
  await request.put("/api/household", {
    data: { householdSize: 2, dietaryPreferences: [], location: "england" },
  });
  await page.goto("/plan");
  await page
    .getByRole("button", { name: /^Start (a|a new|another) week$/ })
    .click();
  await page
    .getByRole("button", { name: "Start this week", exact: true })
    .click();
  await expect(
    page.getByText("0 meals selected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Browse recipes", exact: true }).click();
  await page.getByLabel("Search recipes").fill("porridge");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Add to week", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add to week", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Add to week", exact: true }).click();
  await page
    .getByRole("link", { name: "Back to meal plan", exact: true })
    .click();
  await expect(
    page.getByText("2 meals selected", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Smart-Fill Remaining Meals", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "A mix for your week" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("2 meals selected", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Smart-Fill Remaining Meals", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add these meals", exact: true })
    .click();
  await expect(
    page.getByText("21 meals selected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Shopping", exact: true }).click();
  const unchecked = page
    .locator('input[type="checkbox"]:not(:checked)')
    .first();
  const checkName = await unchecked.getAttribute("aria-label");
  const first = page.getByRole("checkbox", { name: checkName!, exact: true });
  await first.click();
  await page.reload();
  await page.getByRole("button", { name: "Shopping", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: checkName!, exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Save as template", exact: true })
    .click();
  await page
    .getByLabel("Template name", { exact: true })
    .fill(`Usual ${test.info().project.name} ${Date.now()}`);
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "Use for a new week" }).last().click();
  await page
    .getByRole("button", { name: "Start this week", exact: true })
    .click();
  await expect(
    page.getByText("21 meals selected", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await page.getByRole("link", { name: "View", exact: true }).first().click();
  await expect(
    page.getByText("Archived · Read-only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/planner-${test.info().project.name}.png`,
    fullPage: true,
  });
});
