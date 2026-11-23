import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/**
 * The toast that says `text`, read in the page's toast region. The page's announcer says each toast once more, out
 * of sight, for a screen reader, so the same words stand twice on the page and only the toast is the one a reader
 * sees.
 */
export const toastSaying = (page: Page, text: string | RegExp) =>
  page.locator('[data-slot="toast-region"]').getByText(text);

/**
 * Closes the toasts an action raised, as a reader does: on a phone they stand over the top of the screen, where the
 * header's actions sit, so a press there would land on a toast and keep it open.
 */
export async function closeToasts(page: Page) {
  const toasts = page.locator('[data-slot="toast"]');
  await expect(async () => {
    if ((await toasts.count()) > 0) {
      await page
        .getByRole("button", { name: "Close notification" })
        .first()
        .click({ timeout: 1000 });
    }
    await expect(toasts).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: readinessTimeoutMilliseconds });
}
