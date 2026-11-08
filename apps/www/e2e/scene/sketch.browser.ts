import { expect, type Page, test } from "@playwright/test";
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
/** The card's play button, found by its accessible name. */
const PLAY = /play/iu;

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
  const before = yield* Effect.promise(() =>
    card.locator(COUNT).getAttribute("data-bacteria-count")
  );
  yield* Effect.promise(() =>
    card.getByRole("button", { name: PLAY }).first().click()
  );
  // One generation passes while it plays, so the count it shows changes.
  yield* Effect.promise(() =>
    expect(card.locator(COUNT)).not.toHaveAttribute(
      "data-bacteria-count",
      before ?? "",
      { timeout: revealTimeoutMilliseconds }
    )
  );
});

test.describe("lesson sketch", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("the bacterial growth sketch draws its dish and grows while it plays", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, expectSketchPlays(page))
    );
  });
});
