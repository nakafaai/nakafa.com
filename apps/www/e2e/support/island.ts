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

/** Presses the middle of the world, with a finger on a touch screen and the mouse elsewhere. */
export const pressWorld = Effect.fn("NakafaE2E.pressWorld")(function* (
  page: Page,
  hasTouch: boolean
) {
  const box = yield* Effect.promise(() => islandStage(page).boundingBox());
  if (box === null) {
    return yield* Effect.die("the island's canvas has no box");
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  yield* Effect.promise(() =>
    hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)
  );
});
