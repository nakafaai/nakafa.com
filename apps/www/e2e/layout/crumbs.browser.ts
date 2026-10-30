import { expect, test } from "@playwright/test";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

// A phone's width folds every ancestor of the path into the breadcrumb's More menu.
test.use({ viewport: { height: 844, width: 390 } });

test("every folded breadcrumb item carries its icon", async ({ page }) => {
  await page.goto(pinnedRoutes.material.en);
  const more = page
    .getByRole("navigation", { name: "breadcrumb" })
    .getByRole("button", { name: "More" });
  await expect(more).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(more);
  await more.click();

  const items = page.getByRole("menu").getByRole("menuitem");
  await expect(items.first()).toBeVisible();
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index++) {
    await expect(items.nth(index).locator("svg")).toHaveCount(1);
  }
  await page.getByRole("menu").screenshot({
    path: test.info().outputPath("folded-breadcrumb.png"),
  });
});
