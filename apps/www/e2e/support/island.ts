import { expect, type Page } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { pressDecline } from "@/e2e/support/consent";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The island game of the signed-in learner. */
const ISLAND_PATH = "/en/island";

/** The game's canvas. */
export const islandStage = (page: Page) => page.getByTestId("island-stage");

/**
 * Waits until the world has changed this many times since the game opened: the
 * canvas names the count of every change it drew.
 */
export const expectRevision = (page: Page, revision: number) =>
  expect(islandStage(page)).toHaveAttribute("data-revision", String(revision));

/**
 * Opens the learner's island and waits for its first frame. The game loads its
 * renderer once the learner enters, and a machine busy with other work
 * stretches that past the default five seconds, so the wait is a deferred
 * scene's. A learner asked about usage data declines first; a runtime where
 * the choice is made shows no card, so the helper looks once and never waits.
 */
export const openIsland = Effect.fn("NakafaE2E.openIsland")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* Effect.promise(() => page.goto(ISLAND_PATH));
  yield* Effect.promise(() =>
    expect(islandStage(page)).toHaveAttribute("data-drawn", "true", {
      timeout: revealTimeoutMilliseconds,
    })
  );
  const asked = yield* Effect.promise(() =>
    page
      .getByRole("button", { exact: true, name: en.AnalyticsConsent.decline })
      .isVisible()
  );
  if (asked) {
    yield* pressDecline(page, hasTouch);
  }
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

/** Presses the middle of the world, where the village's well stands: a single block goes on it and comes off it. */
export const pressWorld = (page: Page, hasTouch: boolean) =>
  pressAt(page, hasTouch, 0.5, 0.5);

/**
 * Spots round the village where the ground is often open, as shares of the
 * screen's width and height. Every learner's island grows its own trees and
 * its own animals wander it, so no one spot is free on every island.
 */
const OPEN_SPOTS = [
  [0.1, 0.3],
  [0.07, 0.55],
  [0.3, 0.6],
  [0.93, 0.62],
  [0.05, 0.75],
  [0.2, 0.22],
  [0.86, 0.5],
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
    return yield* Effect.die("no open spot round the village took the press");
  }
);
