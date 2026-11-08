import { expect, type Page } from "@playwright/test";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The island's canvas once its first frame has drawn. */
export const drawnIsland = (page: Page) => page.locator("canvas[data-drawn]");

/**
 * Waits for the island's first frame. The canvas loads three.js on intent, and
 * a machine busy with other work stretches that past the default five seconds,
 * so the wait is a deferred scene's.
 */
export const expectDrawnIsland = (page: Page) =>
  expect(drawnIsland(page)).toBeVisible({ timeout: revealTimeoutMilliseconds });
