import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { activate, visibleLink } from "@/e2e/support/input";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { finishSection, runFirstSection } from "@/e2e/support/player";
import { CARD } from "@/e2e/support/selector";
import {
  readinessTimeoutMilliseconds,
  revealTimeoutMilliseconds,
} from "@/e2e/support/timeout";
import { arrive, LOCKED_SHELL, setHref } from "@/e2e/support/tryout";
import { compactViewport } from "@/e2e/support/viewport";

/** The English route prefix that the walked set's addresses start with. */
const ENGLISH_PREFIX = /^\/en\//;

/** The review that a free learner sees once the whole attempt is finished. */
const LOCKED_REVIEW = '[data-slot="tryout-review-locked"]';

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
 * The section rows of the learner's attempt on its set page. Each one carries
 * the attempt's id, which the rows show only once the attempt has resolved.
 */
const attemptRows = (page: Page) =>
  page.locator(`main a[href^="${setHref}/"][href*="attemptId="]`);

/** The address of every attempt row that the set page shows, in its order. */
const readRowHrefs = (page: Page) =>
  attemptRows(page).evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? "")
  );

/** The pathname of a section row's address, resolved against the page that shows it. */
const pathOf = (page: Page, href: string) => new URL(href, page.url()).pathname;

/**
 * Starts one section row of the running attempt and finishes it. Any section
 * but the last returns to the set page, still locked. The last one completes
 * the attempt, which unlocks the shell, so this waits for the review instead.
 */
const finishSectionRow = Effect.fn("NakafaE2E.finishTryoutSectionRow")(
  function* (page: Page, href: string, last: boolean) {
    const path = pathOf(page, href);
    const start = page.getByRole("button", { exact: true, name: "Start" });
    const finish = page.getByRole("button", { exact: true, name: "Finish" });

    yield* activate(visibleLink(page, href, "main"), false);
    yield* arrive(
      page,
      (url) => url.pathname === path && url.searchParams.has("attemptId"),
      page.locator(LOCKED_SHELL),
      "attached"
    );
    yield* Effect.promise(() =>
      expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
    );
    yield* activate(start, false);
    yield* Effect.promise(() =>
      expect(finish).toBeVisible({ timeout: readinessTimeoutMilliseconds })
    );
    if (!last) {
      yield* finishSection(page, false);
      return;
    }
    yield* activate(finish, false);
    yield* activate(
      page
        .getByRole("dialog")
        .getByRole("button", { exact: true, name: "Finish" }),
      false
    );
    yield* Effect.promise(() =>
      expect(page.locator(LOCKED_REVIEW)).toBeVisible({
        timeout: revealTimeoutMilliseconds,
      })
    );
  }
);

/**
 * Finishes every section row of the running attempt except the one already
 * finished. A free learner's review opens only once the whole attempt is over,
 * so each section is started and finished from its row on the set page.
 */
const finishOtherSections = Effect.fn("NakafaE2E.finishOtherTryoutSections")(
  function* (page: Page, finishedPath: string) {
    yield* Effect.promise(() =>
      expect(attemptRows(page).filter({ visible: true }).first()).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      })
    );
    const hrefs = yield* Effect.promise(() => readRowHrefs(page));
    const others = Arr.dedupeWith(
      Arr.filter(hrefs, (href) => pathOf(page, href) !== finishedPath),
      (left: string, right: string) =>
        pathOf(page, left) === pathOf(page, right)
    );
    const last = others.length - 1;
    yield* Effect.forEach(
      others,
      (href, index) => finishSectionRow(page, href, index === last),
      { discard: true }
    );
  }
);

/**
 * Finishes the sections of a set as a free learner, then opens the review of
 * the first section in Indonesian on a compact phone. The offer's two actions
 * must sit inside its card, and each label must fit its own action.
 */
const verifyOfferActions = Effect.fn("NakafaE2E.verifyTryoutOfferActions")(
  function* (page: Page, baseURL: string) {
    yield* runFirstSection(page, false, baseURL);
    const section = new URL(page.url());
    yield* finishSection(page, false);
    yield* finishOtherSections(page, section.pathname);

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
      expect(page.locator(LOCKED_REVIEW)).toBeVisible({
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

test.describe("The Pro offer of a finished set, on a compact phone", () => {
  // The review opens only once every section of the set is finished, so this
  // flow runs each section in turn before it checks the offer.
  test.describe.configure({ timeout: 240_000 });

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
});
