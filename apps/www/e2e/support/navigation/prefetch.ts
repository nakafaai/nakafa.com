import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Clock, Effect } from "effect";
import { loadMathFonts } from "@/e2e/support/fonts";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { settleRouter } from "@/e2e/support/navigation/settle";
import { recordServerFunctionCalls } from "@/e2e/support/requests";
import {
  expectStillShell,
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Loads `href` with the frame recorder running and its router hydrated. */
export const openObservedRoute = Effect.fn("NakafaE2E.openObservedRoute")(
  function* (page: Page, href: string) {
    yield* observeShell(page);
    yield* Effect.promise(() =>
      page.goto(href, { waitUntil: "domcontentloaded" })
    );
    yield* waitForCommittedAppRouter(
      page,
      href,
      href,
      readinessTimeoutMilliseconds
    );
  }
);

/** Reads the path a link opens. */
const readPathname = Effect.fn("NakafaE2E.readLinkPathname")(function* (
  link: Locator
) {
  const href = yield* Effect.promise(() => link.getAttribute("href")).pipe(
    Effect.flatMap(Effect.fromNullishOr)
  );
  return new URL(href, "https://nakafa.com").pathname;
});

/** The first paragraph of the page's article. */
const articleText = (page: Page) =>
  page.getByRole("article").locator("p").first();

/**
 * Records the time from a press to the content it reveals on the test report,
 * so every navigation's click-to-content time is visible in the run's output.
 */
const recordClickToContent = Effect.fn("NakafaE2E.recordClickToContent")(
  function* (milliseconds: number) {
    yield* Effect.sync(() => {
      const info = test.info();
      info.annotations = Arr.append(info.annotations, {
        description: `${Math.round(milliseconds)} ms`,
        type: "click-to-content",
      });
    });
  }
);

/**
 * Shows the reader's intent toward `link`, waits until the router has loaded
 * what the link preloads, then runs `press` and `arrive`. The press is the
 * reader's own gesture. Its destination must show through `arrive`, and the
 * router must make no data request for it: the loader data came with the
 * preload. Every frame from the press on keeps the one app shell, with no empty
 * frame and no layout shift.
 */
export const pressPreloaded = Effect.fn("NakafaE2E.pressPreloaded")(function* <
  PressError,
  PressRequirements,
  ArriveError,
  ArriveRequirements,
>(
  page: Page,
  link: Locator,
  hasTouch: boolean,
  press: Effect.Effect<void, PressError, PressRequirements>,
  arrive: Effect.Effect<void, ArriveError, ArriveRequirements>,
  // How many `<main>` elements the move shows: one within a shell, two across shells.
  shells = 1
) {
  yield* settleRouter(
    page,
    Effect.promise(() =>
      link
        .scrollIntoViewIfNeeded()
        .then(() =>
          hasTouch ? link.dispatchEvent("touchstart") : link.focus()
        )
    )
  );
  yield* loadMathFonts(page);
  const since = yield* readPageTime(page);
  const dataCalls = recordServerFunctionCalls(page);
  const pressedAt = yield* Clock.currentTimeMillis;
  yield* press;
  yield* arrive;
  const shownAt = yield* Clock.currentTimeMillis;
  yield* Effect.sync(() => expect(dataCalls.length).toBe(0));
  yield* recordClickToContent(shownAt - pressedAt);
  const observation = yield* readShellObservation(page, since);
  yield* Effect.sync(() => expectStillShell(observation, [false], shells));
});

/**
 * Opens a link that the reader showed intent toward, and checks the destination
 * paints from that preload: its own heading replaces the source heading, and its
 * article shows, with the contract of `pressPreloaded`.
 */
export const openPrefetched = Effect.fn("NakafaE2E.openPrefetched")(function* (
  page: Page,
  link: Locator,
  hasTouch: boolean
) {
  const pathname = yield* readPathname(link);
  const heading = page.getByRole("heading", { level: 1 });
  const source = yield* Effect.promise(() => heading.innerText());
  yield* pressPreloaded(
    page,
    link,
    hasTouch,
    Effect.promise(() =>
      hasTouch
        ? link.tap({ noWaitAfter: true })
        : link.press("Enter", { noWaitAfter: true })
    ),
    Effect.promise(() =>
      page
        .waitForURL((url) => url.pathname === pathname, {
          timeout: readinessTimeoutMilliseconds,
        })
        .then(() =>
          expect(heading).toHaveCount(1, {
            timeout: readinessTimeoutMilliseconds,
          })
        )
        .then(() => expect(heading).not.toHaveText(source))
        .then(() =>
          expect(articleText(page)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          })
        )
    )
  );
});
