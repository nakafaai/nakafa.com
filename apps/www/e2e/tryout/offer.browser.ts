import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { activate } from "@/e2e/support/input";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { runFirstSection } from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { arrive, onPath, setHref } from "@/e2e/support/tryout";
import { compactViewport } from "@/e2e/support/viewport";

/** The shell's lock attribute, which the lock store sets once a page hydrates. */
const LOCKED_SHELL = "[data-slot=sidebar-wrapper][data-locked]";

/** The English route prefix that the walked set's addresses start with. */
const ENGLISH_PREFIX = /^\/en\//;

/** The Pro offer's card: the card that holds the offer's heading. */
const offerCard = (page: Page) =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.locator("#tryout-review-offer") });

/**
 * Finishes the running section, then waits until the attempt's set shows again,
 * still locked, so the server has stored the finish before the page moves on.
 */
const finishSection = Effect.fn("NakafaE2E.finishTryoutSection")(function* (
  page: Page
) {
  yield* activate(
    page.getByRole("button", { exact: true, name: "Finish" }),
    false
  );
  yield* activate(
    page
      .getByRole("dialog")
      .getByRole("button", { exact: true, name: "Finish" }),
    false
  );
  yield* arrive(
    page,
    (url) => onPath(setHref)(url) && url.searchParams.has("attemptId"),
    page.locator(LOCKED_SHELL),
    "attached"
  );
});

/** Measures each action of the offer's footer against its card and its own box. */
const measureOfferActions = (page: Page) =>
  offerCard(page)
    .locator('[data-slot="card-footer"] a, [data-slot="card-footer"] button')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const card = element
          .closest('[data-slot="card"]')
          ?.getBoundingClientRect();
        const box = element.getBoundingClientRect();
        return {
          clipped: element.scrollWidth > element.clientWidth,
          inside:
            card !== undefined &&
            box.left >= card.left &&
            box.right <= card.right,
          label: element.textContent?.trim() ?? "",
        };
      })
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
    yield* finishSection(page);

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
