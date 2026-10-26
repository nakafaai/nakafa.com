import type { Page } from "@playwright/test";

/**
 * Closes the sitting that the page's proctor dashboard shows: Close sitting from the menu beside
 * Change token in the header, then its confirmation.
 */
export async function closeSitting(page: Page) {
  await page
    .locator('[data-slot="page-header"]')
    .getByRole("button", { name: "More actions" })
    .click();
  await page.getByRole("menuitem", { name: "Close sitting" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close sitting", exact: true })
    .click();
}
