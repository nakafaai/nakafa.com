import { expect, test } from "@playwright/test";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** Any address at all. */
const SOME_ADDRESS = /./u;

// A phone's width folds every ancestor of the path into the breadcrumb's More menu.
// An article's path has Home, Articles and its category, so it folds, and it ends at
// the category: the article's title is the heading under it, and a long title in the
// path would cut it. A lesson's breadcrumb names only the lesson and never folds.
test.use({ viewport: { height: 844, width: 390 } });

test("every breadcrumb item is a link, the current page included", async ({
  page,
}) => {
  await page.goto(pinnedRoutes.article.en);
  const path = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(path.getByRole("button", { name: "More" })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  for (const item of await path.getByRole("link").all()) {
    await expect(item).toHaveAttribute("href", SOME_ADDRESS);
  }

  await page.goto(pinnedRoutes.material.en);
  const current = page
    .getByRole("navigation", { name: "breadcrumb" })
    .locator('[aria-current="page"]');
  await expect(current).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await expect(current).toHaveAttribute("href", SOME_ADDRESS);
});

test("every folded breadcrumb item carries its icon", async ({ page }) => {
  await page.goto(pinnedRoutes.article.en);
  const more = page
    .getByRole("navigation", { name: "breadcrumb" })
    .getByRole("button", { name: "More" });
  await expect(more).toBeVisible({ timeout: readinessTimeoutMilliseconds });
  await waitUntilTakenOver(more);
  await more.click();

  const items = page.getByRole("menu").getByRole("menuitem");
  await expect(items.first()).toBeVisible();
  const all = await items.all();
  expect(all.length).toBeGreaterThan(0);
  for (const item of all) {
    await expect(item.locator("svg")).toHaveCount(1);
  }
  await page.getByRole("menu").screenshot({
    path: test.info().outputPath("folded-breadcrumb.png"),
  });
});
