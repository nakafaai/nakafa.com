import type { Page } from "@playwright/test";

/**
 * The toast that says `text`, read in the page's toast region. The page's announcer says each toast once more, out
 * of sight, for a screen reader, so the same words stand twice on the page and only the toast is the one a reader
 * sees.
 */
export const toastSaying = (page: Page, text: string | RegExp) =>
  page.locator('[data-slot="toast-region"]').getByText(text);
