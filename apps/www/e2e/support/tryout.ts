import { expect, type Locator, type Page } from "@playwright/test";
import { Effect } from "effect";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";

export const readinessTimeoutMilliseconds = 15_000;
export const hubHref = "/en/try-out";
export const countryHref = `${hubHref}/indonesia`;
export const examHref = `${countryHref}/snbt`;
export const trackHref = `${examHref}/2027`;
export const setHref = `${trackHref}/set-1`;
const SECTION_HREF_PATTERN =
  /^\/en\/try-out\/indonesia\/snbt\/2027\/set-1\/[^/?]+(\?attemptId=[^&]+)?$/;

/** The viewports every try-out suite walks. */
export const viewports = [
  { hasTouch: false, height: 900, name: "desktop", width: 1440 },
  { hasTouch: true, height: 844, name: "touch", width: 390 },
] as const;

/** The first link to `href` that the current page shows. */
export function visibleLink(page: Page, href: string) {
  return page
    .locator(`main a[href="${href}"]`)
    .filter({ visible: true })
    .first();
}

/** The first section link that the current set page shows. */
export function sectionLink(page: Page) {
  return page
    .locator(`main a[href^="${setHref}/"]`)
    .filter({ visible: true })
    .first();
}

/** Clicks or taps a control without waiting for the navigation it starts. */
export function press(control: Locator, hasTouch: boolean) {
  return hasTouch
    ? control.tap({ noWaitAfter: true })
    : control.click({ noWaitAfter: true });
}

/** Scrolls a control into view and activates it. */
export const activate = Effect.fn("NakafaE2E.activateTryoutControl")(function* (
  control: Locator,
  hasTouch: boolean
) {
  yield* Effect.promise(() => control.scrollIntoViewIfNeeded());
  yield* Effect.promise(() => press(control, hasTouch));
});

/** Waits until the browser shows `pathname` and the page's next control. */
export const arrive = Effect.fn("NakafaE2E.arriveAtTryoutPage")(function* (
  page: Page,
  pathname: string,
  ready: Locator
) {
  yield* Effect.promise(() =>
    expect(page).toHaveURL((url) => url.pathname === pathname, {
      timeout: readinessTimeoutMilliseconds,
    })
  );
  yield* Effect.promise(() =>
    expect(ready).toBeVisible({ timeout: readinessTimeoutMilliseconds })
  );
});

/** Loads the try-out hub and waits until it is ready for the next click. */
export const openHub = Effect.fn("NakafaE2E.openTryoutHub")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.goto(hubHref, { waitUntil: "domcontentloaded" })
  );
  yield* waitForCommittedAppRouter(
    page,
    hubHref,
    hubHref,
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() =>
    expect(visibleLink(page, countryHref)).toBeVisible({
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
    yield* activate(visibleLink(page, href), hasTouch);
    yield* arrive(page, href, visibleLink(page, next));
  }
});

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
