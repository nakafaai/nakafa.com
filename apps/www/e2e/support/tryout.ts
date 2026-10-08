import { expect, type Locator, type Page } from "@playwright/test";
import { Effect, MutableHashSet } from "effect";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { NEXT_ROUTER_PREFETCH_HEADER } from "@/e2e/support/requests";

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

/**
 * Records every pathname the page asks for beyond its shared shell. A try-out
 * link in view only asks for the shell, which Next.js marks with "1"; it asks
 * for the rest once intent reaches React. Start recording before the link can
 * render, because a pointer that rests where the link appears shows intent on
 * its own.
 */
export function recordIntentRequests(page: Page) {
  const pathnames = MutableHashSet.empty<string>();
  page.on("request", (request) => {
    const headers = request.headers();
    if (headers.rsc === "1" && headers[NEXT_ROUTER_PREFETCH_HEADER] !== "1") {
      MutableHashSet.add(pathnames, new URL(request.url()).pathname);
    }
  });
  return pathnames;
}

/**
 * Rests on a link the way a pointer or a finger does before it presses, and
 * waits until the link has asked for more than the shell. Playwright presses
 * in the same instant as intent arrives, so a press without this step can
 * navigate as if nobody had shown intent.
 */
export const intend = Effect.fn("NakafaE2E.intendTryoutLink")(function* (
  link: Locator,
  target: { hasTouch: boolean; pathname: string },
  requested: MutableHashSet.MutableHashSet<string>
) {
  yield* Effect.promise(() =>
    target.hasTouch ? link.dispatchEvent("touchstart") : link.hover()
  );
  yield* Effect.promise(() =>
    expect
      .poll(() => MutableHashSet.has(requested, target.pathname), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(true)
  );
});

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

/**
 * The set page's first section link once the learner's attempt has resolved.
 * The resolved set replaces the catalog view's rows, and a row that is replaced
 * in the middle of a press loses the press.
 */
export const settledSection = Effect.fn("NakafaE2E.settledTryoutSection")(
  function* (page: Page) {
    yield* arrive(
      page,
      setHref,
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
