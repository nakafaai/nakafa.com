import type { Locator, Page } from "@playwright/test";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";

/**
 * Longer than one turn of the lesson window, which opens the next lesson every
 * six seconds while it is on screen and nobody holds it.
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
  return lessonSection(page).locator('[data-slot="lesson-panel"]:not([inert])');
}

/** The lesson window's buttons, one per subject, in the window's order. */
export function lessonButtons(page: Page) {
  return lessonSection(page)
    .locator('[data-slot="button-group"]')
    .getByRole("button");
}

/**
 * The whole lesson window: its buttons and its panels. Its height is the one of
 * its tallest panel, and its lab mounts once at least half of it is on the screen.
 */
export function lessonWindow(page: Page) {
  return lessonSection(page).locator('[data-slot="lesson-window"]');
}

/** The visual of a lesson, found by the name of its view. */
export function lessonVisual(page: Page, name: string) {
  return lessonSection(page).getByRole("region", { name });
}

/** The share of a box that lies inside the viewport, from 0 to 1. A missing or empty box has none. */
export function visibleShare(
  box: Awaited<ReturnType<Locator["boundingBox"]>>,
  viewportHeight: number
) {
  if (box === null || box.height <= 0) {
    return 0;
  }
  const visible =
    Math.min(box.y + box.height, viewportHeight) - Math.max(box.y, 0);
  return Math.max(0, visible) / box.height;
}
