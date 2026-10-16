import type { Page } from "@playwright/test";

/**
 * Longer than a turn would take: a lesson that changed by itself within this
 * time would show it. The window turns only when the reader picks a tab.
 */
export const LESSON_WAIT_MS = 8000;

/** The open lesson's panel of the home page's lesson window. */
export function lessonPanel(page: Page) {
  return page.locator("#lesson").getByRole("tabpanel");
}

/** The tab row, which is the top of the lesson window. */
export function lessonTabs(page: Page) {
  return page.locator("#lesson").getByRole("tablist");
}

/** The visual of a lesson, found by the name of its view. */
export function lessonVisual(page: Page, name: string) {
  return page.locator("#lesson").getByRole("region", { name });
}
