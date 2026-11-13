import { expect, test } from "@playwright/test";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** An article category, whose crumb opens every category. */
const CATEGORY = "/en/articles/politics";

/**
 * The owner's rule (13 Nov): the path is the page's navigation, as Google Drive's is. A crumb with siblings shows its
 * name and a caret, and a press opens a menu of the pages at its place, the crumb's own page checked and marked as the
 * current page, at every width from a phone to a desktop. Each option is a link, so it navigates as a link does.
 */
for (const width of [320, 390, 768, 1440]) {
  test(`a crumb opens its siblings at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ height: 844, width });
    await page.goto(CATEGORY);
    const path = page.getByRole("navigation", { name: "breadcrumb" });
    const crumb = path.getByRole("button", { name: "Politics" });
    await expect(crumb).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await crumb.click();

    const menu = page.getByRole("menu", { name: "Categories" });
    await expect(menu).toBeVisible();
    const current = menu.getByRole("menuitemradio", { name: "Politics" });
    await expect(current).toHaveAttribute("aria-checked", "true");
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(current).toHaveAttribute("href", CATEGORY);
    for (const option of await menu.getByRole("menuitemradio").all()) {
      await expect(option.locator("svg").first()).toBeVisible();
    }

    await current.click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${CATEGORY}$`, "u"));
  });
}
