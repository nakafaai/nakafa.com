import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Effect } from "effect";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The island game of the signed-in learner. */
const ISLAND_PATH = "/en/island";

/** The game's canvas. */
export const islandStage = (page: Page) => page.getByTestId("island-stage");

/** How many times the world changed since the game opened: the canvas names the count of every change it drew. */
export const revisionOf = async (page: Page) =>
  Number(await islandStage(page).getAttribute("data-revision"));

/** Waits until the world changed again after it had changed `before` times. */
export const expectChanged = (page: Page, before: number) =>
  expect
    .poll(() => revisionOf(page), { timeout: revealTimeoutMilliseconds })
    .toBeGreaterThan(before);

/**
 * Opens the learner's world and waits until it rests: its first frame is
 * drawn, what the server holds about the home has arrived, and the camp fire
 * a first visit is given has landed. The game loads its renderer once the
 * learner enters, and a machine busy with other work stretches that past the
 * default five seconds, so the wait is a deferred scene's.
 */
export const openIsland = Effect.fn("NakafaE2E.openIsland")(function* (
  page: Page
) {
  yield* Effect.promise(() => page.goto(ISLAND_PATH));
  yield* Effect.promise(() =>
    expect(islandStage(page)).toHaveAttribute("data-settled", "true", {
      timeout: revealTimeoutMilliseconds,
    })
  );
});

/** Presses the world at a share of its width and height, with a finger on a touch screen and the mouse elsewhere. */
const pressAt = Effect.fn("NakafaE2E.pressAt")(function* (
  page: Page,
  hasTouch: boolean,
  across: number,
  down: number
) {
  const box = yield* Effect.promise(() => islandStage(page).boundingBox());
  if (box === null) {
    return yield* Effect.die("the island's canvas has no box");
  }
  const x = box.x + box.width * across;
  const y = box.y + box.height * down;
  yield* Effect.promise(() =>
    hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)
  );
});

/**
 * Spots round the home where the ground is often open, as shares of the
 * screen's width and height. Every learner's world grows its own trees and
 * its own animals wander it, so no one spot is free in every world; the
 * dock, the shelf and the status bars cover the rest of the screen.
 */
const OPEN_SPOTS = [
  [0.5, 0.42],
  [0.35, 0.36],
  [0.65, 0.36],
  [0.42, 0.28],
  [0.6, 0.46],
  [0.3, 0.44],
  [0.72, 0.3],
] as const;

/** How long the game has to answer one press before the next spot is tried. */
const ANSWER_MILLISECONDS = 1500;

/**
 * Presses one open spot after another until the game took the press, as a
 * learner does who is told there is no room: `took` reads whether it did.
 * It fails when no spot answered.
 */
export const pressOpenGround = Effect.fn("NakafaE2E.pressOpenGround")(
  function* (page: Page, hasTouch: boolean, took: () => Promise<boolean>) {
    for (const [across, down] of OPEN_SPOTS) {
      yield* pressAt(page, hasTouch, across, down);
      const answered = yield* Effect.promise(() =>
        expect
          .poll(took, { timeout: ANSWER_MILLISECONDS })
          .toBe(true)
          .then(
            () => true,
            () => false
          )
      );
      if (answered) {
        return;
      }
    }
    return yield* Effect.die("no open spot round the home took the press");
  }
);
