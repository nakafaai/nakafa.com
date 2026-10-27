import type { Page } from "@playwright/test";
import { waitUntilTakenOver } from "@/e2e/support/window";

/**
 * Closes the sitting that the page's proctor dashboard shows: Close sitting from the menu beside
 * Change token in the header, then its confirmation. The menu opens only once React has taken the
 * header over, so a dashboard just opened waits for it before the press.
 */
export async function closeSitting(page: Page) {
  const more = page
    .locator('[data-slot="page-header"]')
    .getByRole("button", { name: "More actions" });
  await waitUntilTakenOver(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Close sitting" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close sitting", exact: true })
    .click();
}
