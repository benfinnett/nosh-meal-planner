import { expect, test } from "@playwright/test";

test("household settings autosave and survive reload at every viewport", async ({
  page,
  request,
}) => {
  const original = await (await request.get("/api/household")).json();
  try {
    await request.put("/api/household", {
      data: { householdSize: 1, dietaryPreferences: [], location: "england" },
    });
    await page.goto("/household");
    const size = page.getByRole("spinbutton");
    await expect(size).toHaveValue("1");
    await size.focus();
    await page.keyboard.press("ArrowUp");
    await expect(size).toHaveValue("2");
    await page.getByLabel("Vegetarian", { exact: true }).check();
    await page.getByLabel("Dairy-free", { exact: true }).check();
    await page.getByRole("combobox").selectOption("scotland");
    await expect(
      page.getByRole("heading", { name: "Best Start Foods" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("Saved");
    await page.reload();
    await expect(size).toHaveValue("2");
    await expect(page.getByLabel("Vegetarian", { exact: true })).toBeChecked();
    await expect(page.getByLabel("Dairy-free", { exact: true })).toBeChecked();
    await expect(page.getByRole("combobox")).toHaveValue("scotland");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/household-${test.info().project.name}.png`,
      fullPage: true,
    });
    const support = page.getByRole("link", {
      name: /Find out about Best Start Foods/,
    });
    await support.scrollIntoViewIfNeeded();
    const box = await support.boundingBox();
    const mobileNav = page.getByRole("navigation", {
      name: "Main navigation (mobile)",
      exact: true,
    });
    if (await mobileNav.isVisible()) {
      const nav = await mobileNav.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
    }
    await page.getByRole("combobox").selectOption("unspecified");
    await expect(page.getByRole("status")).toHaveText("Saved");
    await page.reload();
    await expect(page.getByRole("combobox")).toHaveValue("unspecified");
    await expect(page.getByRole("complementary")).toHaveCount(0);
  } finally {
    await request.put("/api/household", { data: original });
  }
});
