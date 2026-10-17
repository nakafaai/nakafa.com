import type { Page } from "@playwright/test";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";

/**
 * Longer than a turn would take: a lesson that changed by itself within this
 * time would show it. The window turns only when the reader picks a tab.
 */
export const LESSON_WAIT_MS = 8000;

/** The view of the home page's first lesson, named in Indonesian as the page is read. */
export const PROJECTILE_VIEW = "Visual lintasan bola lontar";

/** The home page's lesson section, which holds the lesson window. */
export function lessonSection(page: Page) {
  return page.locator(`#${LESSON_SECTION_ID}`);
}

/** The open lesson's panel of the home page's lesson window. */
export function lessonPanel(page: Page) {
  return lessonSection(page).getByRole("tabpanel");
}

/**
 * The whole lesson window: its tabs and its panels. Its height is the one of its
 * tallest panel, and its lab mounts once at least half of it is on the screen.
 */
export function lessonWindow(page: Page) {
  return lessonSection(page).locator('[data-slot="tabs"]');
}

/** The visual of a lesson, found by the name of its view. */
export function lessonVisual(page: Page, name: string) {
  return lessonSection(page).getByRole("region", { name });
}
