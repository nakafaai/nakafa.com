import { expect, type Locator, type Page } from "@playwright/test";
import { Effect, type MutableList } from "effect";
import { activate, visibleLink } from "@/e2e/support/input";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const countryHref = `${appRoutes.tryout}/indonesia`;
const examHref = `${countryHref}/snbt`;
export const trackHref = `${examHref}/2027`;
export const setHref = `${trackHref}/set-1`;
const SECTION_HREF_PATTERN =
  /^\/en\/try-out\/indonesia\/snbt\/2027\/set-1\/[^/?]+(\?attemptId=[^&]+)?$/;

/** The shell's lock attribute, which the lock store sets once a page hydrates. */
export const LOCKED_SHELL = "[data-slot=sidebar-wrapper][data-locked]";

/** The first section link that the current set page shows. */
export function sectionLink(page: Page) {
  return page
    .locator(`main a[href^="${setHref}/"]`)
    .filter({ visible: true })
    .first();
}

/**
 * Rests on a link the way a pointer or a finger does before it presses, and
 * waits until the link has asked for more than the shell: a server function
 * call or a static answer, which `recordDataRequests` records. Playwright presses
 * in the same instant as intent arrives, so a press without this step can
 * navigate as if nobody had shown intent.
 */
export const intend = Effect.fn("NakafaE2E.intendTryoutLink")(function* (
  link: Locator,
  target: { hasTouch: boolean },
  calls: MutableList.MutableList<string>
) {
  const callsBefore = calls.length;
  yield* Effect.promise(() =>
    target.hasTouch ? link.dispatchEvent("touchstart") : link.hover()
  );
  yield* Effect.promise(() =>
    expect
      .poll(() => calls.length > callsBefore, {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(true)
  );
});

/** A URL predicate that matches one pathname. */
export const onPath = (pathname: string) => (url: URL) =>
  url.pathname === pathname;

/**
 * Waits until the browser shows a URL that `matches`, and the page's `ready`
 * control at the given `readiness`: attached to the page, or visible to a
 * learner.
 */
export const arrive = Effect.fn("NakafaE2E.arriveAtTryoutPage")(function* (
  page: Page,
  matches: (url: URL) => boolean,
  ready: Locator,
  readiness: "attached" | "visible" = "visible"
) {
  yield* Effect.promise(() =>
    expect(page).toHaveURL(matches, {
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() =>
    readiness === "visible"
      ? expect(ready).toBeVisible({ timeout: readinessTimeoutMilliseconds })
      : expect(ready).toBeAttached({ timeout: readinessTimeoutMilliseconds })
  );
});

/**
 * Waits until the browser shows a page of an attempt, with the shell locked by
 * that attempt. Only a running attempt locks the shell.
 */
export const arriveLocked = Effect.fn("NakafaE2E.arriveLockedTryoutPage")(
  function* (page: Page, matches: (pathname: string) => boolean) {
    yield* arrive(
      page,
      (url) => matches(url.pathname) && url.searchParams.has("attemptId"),
      page.locator(LOCKED_SHELL),
      "attached"
    );
  }
);

/** Loads the try-out hub and waits until it is ready for the next click. */
export const openHub = Effect.fn("NakafaE2E.openTryoutHub")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.goto(appRoutes.tryout, { waitUntil: "domcontentloaded" })
  );
  yield* waitForCommittedAppRouter(
    page,
    appRoutes.tryout,
    appRoutes.tryout,
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() =>
    expect(visibleLink(page, countryHref, "main")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  // A font that swaps in late moves text, which is not what these suites measure.
  yield* Effect.promise(() =>
    page.evaluate(() => document.fonts.ready.then(() => undefined))
  );
});

/** Walks from the hub to the track, ending with the set links on screen. */
export const openTrack = Effect.fn("NakafaE2E.openTryoutTrack")(function* (
  page: Page,
  hasTouch: boolean
) {
  for (const [href, next] of [
    [countryHref, examHref],
    [examHref, trackHref],
    [trackHref, setHref],
  ] as const) {
    yield* activate(visibleLink(page, href, "main"), hasTouch);
    yield* arrive(page, onPath(href), visibleLink(page, next, "main"));
  }
});

/**
 * The set page's first section link once the learner's attempt has resolved.
 * The resolved set replaces the catalog view's rows, and a row that is replaced
 * in the middle of a press loses the press.
 */
export const settledSection = Effect.fn("NakafaE2E.settledTryoutSection")(
  function* (page: Page) {
    yield* arrive(
      page,
      onPath(setHref),
      page.getByRole("button", { exact: true, name: "Start" })
    );
    return sectionLink(page);
  }
);

/** Reads the href of a set's first section link. */
export const readSectionHref = Effect.fn("NakafaE2E.readTryoutSectionHref")(
  function* (section: Locator) {
    const href = yield* Effect.promise(() => section.getAttribute("href")).pipe(
      Effect.flatMap(Effect.fromNullishOr)
    );
    yield* Effect.sync(() => expect(href).toMatch(SECTION_HREF_PATTERN));
    return href;
  }
);
