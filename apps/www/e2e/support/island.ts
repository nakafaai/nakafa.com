import { expect, type Page } from "@playwright/test";
import { Effect } from "effect";
import { pressDecline } from "@/e2e/support/consent";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The island page of the signed-in learner. */
const ISLAND_PATH = "/en/island";

/** The island's canvas once its first frame has drawn. */
export const drawnIsland = (page: Page) => page.locator("canvas[data-drawn]");

/**
 * Waits for the island's first frame. The canvas loads three.js on intent, and
 * a machine busy with other work stretches that past the default five seconds,
 * so the wait is a deferred scene's.
 */
export const expectDrawnIsland = (page: Page) =>
  expect(drawnIsland(page)).toBeVisible({ timeout: revealTimeoutMilliseconds });

/**
 * Opens the signed-in learner's island and waits for its first frame. A new
 * learner's first page asks about usage data in a card over the lower corner,
 * where the island card keeps its actions, so the learner declines first.
 */
export const openIsland = Effect.fn("NakafaE2E.openIsland")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* Effect.promise(() => page.goto(ISLAND_PATH));
  yield* pressDecline(page, hasTouch);
  yield* Effect.promise(() => expectDrawnIsland(page));
});
