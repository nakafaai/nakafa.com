import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { finishSection, runFirstSection } from "@/e2e/support/player";
import { CARD } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { compactViewport } from "@/e2e/support/viewport";

/** The English route prefix that the walked set's addresses start with. */
const ENGLISH_PREFIX = /^\/en\//;

/** The Pro offer's card: the card that holds the offer's heading. */
const offerCard = (page: Page) =>
  page.locator(CARD).filter({ has: page.locator("#tryout-review-offer") });

/** Measures each action of the offer's footer against its card and its own box. */
const measureOfferActions = (page: Page) =>
  offerCard(page)
    .locator('[data-slot="card-footer"] a, [data-slot="card-footer"] button')
    .evaluateAll(
      (elements, cardSelector) =>
        elements.map((element) => {
          const card = element.closest(cardSelector)?.getBoundingClientRect();
          const box = element.getBoundingClientRect();
          return {
            clipped: element.scrollWidth > element.clientWidth,
            inside:
              card !== undefined &&
              box.left >= card.left &&
              box.right <= card.right,
            label: element.textContent?.trim() ?? "",
          };
        }),
      CARD
    );

/**
 * Finishes a section as a free learner, then opens its review in Indonesian on
 * a compact phone. The offer's two actions must sit inside its card, and each
 * label must fit its own action.
 */
const verifyOfferActions = Effect.fn("NakafaE2E.verifyTryoutOfferActions")(
  function* (page: Page, baseURL: string) {
    yield* runFirstSection(page, false, baseURL);
    const section = new URL(page.url());
    yield* finishSection(page, false);

    section.pathname = section.pathname.replace(ENGLISH_PREFIX, "/id/");
    yield* Effect.promise(() =>
      page.setViewportSize({
        height: compactViewport.height,
        width: compactViewport.width,
      })
    );
    yield* Effect.promise(() =>
      page.goto(section.toString(), { waitUntil: "commit" })
    );
    yield* Effect.promise(() =>
      expect(page.locator('[data-slot="tryout-review-locked"]')).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      })
    );
    // Labels are measured in the loaded Inter typeface, not in a fallback.
    yield* Effect.promise(() =>
      page.evaluate(async () => {
        await document.fonts.ready;
      })
    );

    const actions = yield* Effect.promise(() => measureOfferActions(page));
    yield* Effect.sync(() => {
      expect(Arr.map(actions, ({ label }) => label)).toEqual([
        app.Tryouts["paywall-compare"],
        app.Pricing["pro-cta"],
      ]);
      for (const action of actions) {
        expect(action.inside).toBe(true);
        expect(action.clipped).toBe(false);
      }
    });
  }
);

test("keeps the Pro offer's two actions inside its card on a compact phone", async ({
  baseURL,
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.fromNullishOr(baseURL).pipe(
        Effect.flatMap((origin) => verifyOfferActions(page, origin))
      )
    )
  );
});
