import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { CARD } from "@/e2e/support/selector";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A lesson whose bacterial growth card draws its dish with a p5 sketch. */
const EXPONENT_ROUTE =
  "/en/subjects/mathematics/exponential-logarithm/basic-concept";
/** The readout the card keeps on its body, the count of bacteria it shows. */
const COUNT = "[data-bacteria-count]";
/** How long a paused dish must hold still: longer than a generation takes at 1x. */
const HOLD_MILLISECONDS = 3000;

const expectSketchPlays = Effect.fn("NakafaE2E.expectSketchPlays")(function* (
  page: Page
) {
  yield* seedAnalyticsConsent(page, "denied");
  const response = yield* Effect.promise(() =>
    page.goto(EXPONENT_ROUTE, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  const card = page
    .locator(CARD)
    .filter({ has: page.locator(COUNT) })
    .first();
  // Scroll until the card nears the screen, which loads p5 and draws the dish.
  yield* Effect.promise(() =>
    expect(async () => {
      await page.mouse.wheel(0, 600);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator("canvas")).toHaveCount(1, { timeout: 1000 });
    }).toPass({ timeout: revealTimeoutMilliseconds })
  );
  const first = yield* Effect.promise(() =>
    card.locator(COUNT).getAttribute("data-bacteria-count")
  );
  // A sketch is an animation: it grows without a press, so the count changes.
  yield* Effect.promise(() =>
    expect(card.locator(COUNT)).not.toHaveAttribute(
      "data-bacteria-count",
      first ?? "",
      { timeout: revealTimeoutMilliseconds }
    )
  );
  // The band's play toggle reads pressed while the sketch plays; pressing it
  // again pauses, which holds the dish where it stands.
  const play = card.getByRole("button", { exact: true, name: en.Common.play });
  yield* Effect.promise(() =>
    expect(play).toHaveAttribute("aria-pressed", "true")
  );
  yield* Effect.promise(() => play.click());
  yield* Effect.promise(() =>
    expect(play).toHaveAttribute("aria-pressed", "false")
  );
  const held = yield* Effect.promise(() =>
    card.locator(COUNT).getAttribute("data-bacteria-count")
  );
  yield* Effect.promise(() => page.waitForTimeout(HOLD_MILLISECONDS));
  yield* Effect.promise(() =>
    expect(card.locator(COUNT)).toHaveAttribute(
      "data-bacteria-count",
      held ?? ""
    )
  );
});

test.describe("lesson sketch", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("the bacterial growth sketch draws its dish, grows by itself, and holds when paused", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, expectSketchPlays(page))
    );
  });
});
