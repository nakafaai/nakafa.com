import { expect, type Locator, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import { Array as Arr, Effect, Option } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { setLargeText } from "@/e2e/support/footer";
import { CONVEX_SOCKET, decodeSent } from "@/e2e/support/frames";
import { activate, visibleLink } from "@/e2e/support/input";
import {
  confirmFinish,
  finishSection,
  runFirstSection,
  waitForRunningSection,
} from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { arrive, arriveLocked, setHref } from "@/e2e/support/tryout";
import { compactViewport } from "@/e2e/support/viewport";

/** The link to the page's Indonesian address, which the catalog resolves, since a slug can differ by locale. */
const INDONESIAN_ALTERNATE = 'link[rel="alternate"][hreflang="id"]';

/** A question past the section's free samples, whose explanation a free learner may not read. */
const LOCKED_QUESTION = 3;

/** The checkout action that the Pro offer's button starts. */
const CHECKOUT_ACTION = "billing/sessions:generateCheckoutLink";

/**
 * Holds the checkout action open, so the offer's button stays pending, and
 * passes every other frame through as it came.
 */
const holdCheckoutAction = (page: Page) =>
  page.routeWebSocket(CONVEX_SOCKET, (socket) => {
    const server = socket.connectToServer();
    socket.onMessage((message) => {
      const frame = decodeSent(message.toString());
      if (
        Option.isSome(frame) &&
        frame.value.type === "Action" &&
        frame.value.udfPath === CHECKOUT_ACTION
      ) {
        return;
      }
      server.send(message);
    });
    server.onMessage((message) => socket.send(message));
  });

/** The Pro offer that a locked question's explanation shows in its place. */
const offerOf = (page: Page) =>
  page.locator(
    `section[aria-labelledby="question-${LOCKED_QUESTION}-explanation"]`
  );

/**
 * Whether the offer's checkout stands inside the offer, and whether its label is cut. The script runs in the
 * page, so it uses the browser's own APIs.
 */
const readCheckout = (checkout: Locator) =>
  checkout.evaluate((element) => {
    const offer = element.closest("section")?.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return {
      clipped: element.scrollWidth > element.clientWidth,
      inside:
        offer !== undefined &&
        box.left >= offer.left &&
        box.right <= offer.right &&
        box.top >= offer.top &&
        box.bottom <= offer.bottom,
    };
  });

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
 * the attempt, which unlocks the shell, so this waits for the set page instead.
 */
const finishSectionRow = Effect.fn("NakafaE2E.finishTryoutSectionRow")(
  function* (page: Page, href: string, last: boolean) {
    const path = pathOf(page, href);
    const start = page.getByRole("button", { exact: true, name: "Start" });

    yield* activate(visibleLink(page, href, "main"), false);
    yield* arriveLocked(page, (pathname) => pathname === path);
    yield* Effect.promise(() =>
      expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
    );
    yield* activate(start, false);
    yield* waitForRunningSection(page);
    if (!last) {
      yield* finishSection(page, false);
      return;
    }
    yield* confirmFinish(page, false);
    // A completed attempt unlocks the shell, and this set's page shows no
    // review, so wait for its section rows instead.
    yield* arrive(
      page,
      (url) => url.pathname === setHref && url.searchParams.has("attemptId"),
      attemptRows(page).filter({ visible: true }).first()
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
 * the first section in Indonesian on a compact phone, where a question past the
 * free samples offers Pro in its explanation's place. The checkout must sit
 * inside the offer with its whole label, and at large text its spinner must
 * still show.
 */
const verifyOfferActions = Effect.fn("NakafaE2E.verifyTryoutOfferActions")(
  function* (page: Page, baseURL: string) {
    yield* runFirstSection(page, false, baseURL);
    const section = new URL(page.url());
    // The section's Indonesian address is its own, as `penalaran-umum` is `general-reasoning`, so it
    // comes from the page's language link, with the attempt the English address names.
    const alternate = yield* Effect.promise(() =>
      page.locator(INDONESIAN_ALTERNATE).getAttribute("href")
    ).pipe(Effect.flatMap(Effect.fromNullishOr));
    const indonesian = new URL(alternate);
    indonesian.search = section.search;
    // A phone opens one question at a time until the learner saves a view, so the address names the list.
    indonesian.searchParams.set("view", "list");
    yield* finishSection(page, false);
    yield* finishOtherSections(page, section.pathname);

    yield* Effect.promise(() =>
      page.setViewportSize({
        height: compactViewport.height,
        width: compactViewport.width,
      })
    );
    yield* Effect.promise(() => holdCheckoutAction(page));
    yield* Effect.promise(() =>
      page.goto(indonesian.pathname + indonesian.search, {
        waitUntil: "commit",
      })
    );
    const question = page.locator(`#exercise-question-${LOCKED_QUESTION}`);
    yield* Effect.promise(() =>
      expect(question).toBeVisible({ timeout: readinessTimeoutMilliseconds })
    );
    yield* activate(
      question.getByRole("button", {
        exact: true,
        name: app.Tryouts.explanation,
      }),
      false
    );
    const checkout = offerOf(page).getByRole("button", {
      exact: true,
      name: app.Pricing["pro-cta"],
    });
    // Labels are measured in the loaded Inter typeface, not in a fallback.
    yield* Effect.promise(async () => {
      await expect(checkout).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
    });
    const placed = yield* Effect.promise(() => readCheckout(checkout));
    yield* Effect.sync(() => {
      expect(placed).toEqual({ clipped: false, inside: true });
    });

    // Large text keeps the spinner of a pending checkout, so the learner sees that checkout started.
    const rootSize = yield* setLargeText(page);
    yield* activate(checkout, false);
    yield* Effect.promise(() =>
      expect(checkout.locator("svg.animate-spin")).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      })
    );
    yield* Effect.sync(() => {
      expect(rootSize).toBe("32px");
    });
  }
);

test.describe("The Pro offer of a finished set, on a compact phone", () => {
  // The review opens only once every section of the set is finished, so this
  // flow runs each section in turn before it checks the offer.
  test.describe.configure({ timeout: 240_000 });

  test("keeps a locked explanation's Pro checkout inside its offer, and its spinner visible at large text", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      verifyOfferActions(page, origin)
    );
  });
});
