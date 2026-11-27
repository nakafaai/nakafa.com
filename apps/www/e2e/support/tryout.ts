import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Effect } from "effect";
import { activate, visibleLink } from "@/e2e/support/input";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const countryHref = `${appRoutes.tryout}/indonesia`;
export const groupHref = `${countryHref}/snbt/2027`;
export const trackHref = `${groupHref}/utbk`;
export const setHref = `${trackHref}/set-1`;
/** The first section of the set, at its own address. */
export const sectionHref = `${setHref}/general-reasoning`;
/** TKA's one grade today, in English: its page holds the subject cards. */
export const TKA_GRADE = "/en/try-out/indonesia/tka/senior-high-school";
/** The Aufnahmeprüfung's one Studienkolleg and its one test, in English. */
export const DARMSTADT =
  "/en/try-out/germany/aufnahmepruefung/tu-darmstadt-studienkolleg/mathematics";

/** The shell's lock attribute, which the lock store sets once a page hydrates. */
export const LOCKED_SHELL = "[data-slot=sidebar-wrapper][data-locked]";

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

/** Loads Indonesia's try-out page and waits until it is ready for the next click. */
export const openCountry = Effect.fn("NakafaE2E.openTryoutCountry")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.goto(countryHref, { waitUntil: "domcontentloaded" })
  );
  yield* waitForCommittedAppRouter(
    page,
    countryHref,
    countryHref,
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() =>
    expect(visibleLink(page, trackHref, "main")).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    })
  );
  // A font that swaps in late moves text, which is not what these suites measure.
  yield* Effect.promise(() =>
    page.evaluate(() => document.fonts.ready.then(() => undefined))
  );
});

/**
 * Walks from Indonesia's page to the track, ending with the set links on screen: SNBT's
 * card opens its one track's set table, the first click.
 */
export const openTrack = Effect.fn("NakafaE2E.openTryoutTrack")(function* (
  page: Page,
  hasTouch: boolean
) {
  for (const [href, next] of [[trackHref, setHref]] as const) {
    yield* activate(visibleLink(page, href, "main"), hasTouch);
    yield* arrive(page, onPath(href), visibleLink(page, next, "main"));
  }
});

/**
 * Opens the first set from the track's table. Every set opens beside the table at its own address, so this waits
 * for the pane's Start and returns it.
 */
export const openSetPane = Effect.fn("NakafaE2E.openTryoutSetPane")(function* (
  page: Page,
  hasTouch: boolean
) {
  const start = page.getByRole("button", { exact: true, name: "Start" });
  yield* activate(visibleLink(page, setHref, "main"), hasTouch);
  yield* arrive(page, onPath(setHref), start);
  return start;
});

/**
 * Opens a page and lets it finish loading before a test leaves it. In Firefox
 * and WebKit a page left while it was still loading navigated to its own
 * address and interrupted the next one, so a walk across pages waits.
 */
export async function visit(page: Page, href: string) {
  await page.goto(href);
  await page.waitForLoadState("networkidle");
}
