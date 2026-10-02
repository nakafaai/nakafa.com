import { instant } from "@next/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import {
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";

const readinessTimeoutMilliseconds = 15_000;
const hubHref = "/en/try-out";
const countryHref = `${hubHref}/indonesia`;
const examHref = `${countryHref}/snbt`;
const trackHref = `${examHref}/2027`;
const setHref = `${trackHref}/set-1`;
const SECTION_HREF_PATTERN =
  /^\/en\/try-out\/indonesia\/snbt\/2027\/set-1\/[^/?]+$/;

const viewports = [
  { hasTouch: false, height: 900, name: "desktop", width: 1440 },
  { hasTouch: true, height: 844, name: "touch", width: 390 },
] as const;

/** The first link to `href` that the current page shows. */
function visibleLink(page: Page, href: string) {
  return page
    .locator(`main a[href="${href}"]`)
    .filter({ visible: true })
    .first();
}

/** Clicks or taps a link without waiting for the navigation it starts. */
function press(link: Locator, hasTouch: boolean) {
  return hasTouch
    ? link.tap({ noWaitAfter: true })
    : link.click({ noWaitAfter: true });
}

/** Scrolls a link into view and activates it. */
const activate = Effect.fn("NakafaE2E.activateTryoutLink")(function* (
  link: Locator,
  hasTouch: boolean
) {
  yield* Effect.promise(() => link.scrollIntoViewIfNeeded());
  yield* Effect.promise(() => press(link, hasTouch));
});

/** Waits until the browser shows `pathname` and the page's next control. */
const arrive = Effect.fn("NakafaE2E.arriveAtTryoutPage")(function* (
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

/**
 * Opens a set or section while Next.js holds back request-time data, so its
 * heading has to come from the link's prefetch. The learner's attempt streams
 * in once the hold ends.
 */
const openPrefetched = Effect.fn("NakafaE2E.openPrefetchedTryoutPage")(
  function* (
    page: Page,
    link: Locator,
    target: { hasTouch: boolean; pathname: string; title: string }
  ) {
    yield* Effect.promise(() => link.scrollIntoViewIfNeeded());
    // @next/playwright owns this native Promise callback while its lock is held.
    yield* Effect.promise(() =>
      instant(page, () =>
        press(link, target.hasTouch)
          .then(() =>
            page.waitForURL((url) => url.pathname === target.pathname, {
              timeout: readinessTimeoutMilliseconds,
            })
          )
          .then(() =>
            expect(
              page.getByRole("heading", {
                exact: true,
                level: 1,
                name: target.title,
              })
            ).toBeVisible({ timeout: readinessTimeoutMilliseconds })
          )
      )
    );
  }
);

/** Loads the try-out hub and waits until it is ready for the next click. */
const openHub = Effect.fn("NakafaE2E.openTryoutHub")(function* (page: Page) {
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
});

/** Walks from the hub to the track, ending with the set links on screen. */
const openTrack = Effect.fn("NakafaE2E.openTryoutTrack")(function* (
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

/** The first section link that the set page shows. */
function sectionLink(page: Page) {
  return page
    .locator(`main a[href^="${setHref}/"]`)
    .filter({ visible: true })
    .first();
}

/** Reads the href of a set's first section link. */
const readSectionHref = Effect.fn("NakafaE2E.readTryoutSectionHref")(function* (
  section: Locator
) {
  const href = yield* Effect.promise(() => section.getAttribute("href")).pipe(
    Effect.flatMap(Effect.fromNullishOr)
  );
  yield* Effect.sync(() => expect(href).toMatch(SECTION_HREF_PATTERN));
  return href;
});

/**
 * Walks from the try-out catalog to a set and one of its sections, then back,
 * while recording every frame. The app shell must stay one mounted, visible
 * element, every frame must show a page heading, and nothing may shift.
 */
const verifyTryoutShell = Effect.fn("NakafaE2E.verifyTryoutShell")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* seedDeniedAnalyticsConsent(page);
  yield* observeShell(page);
  yield* openHub(page);
  // A font that swaps in late moves text, which is not what this test measures.
  yield* Effect.promise(() =>
    page.evaluate(() => document.fonts.ready.then(() => undefined))
  );
  const since = yield* readPageTime(page);

  yield* openTrack(page, hasTouch);
  yield* activate(visibleLink(page, setHref), hasTouch);
  const section = sectionLink(page);
  yield* arrive(page, setHref, section);
  const sectionHref = yield* readSectionHref(section);
  yield* activate(section, hasTouch);
  const start = page.getByRole("button", { exact: true, name: "Start" });
  yield* arrive(page, sectionHref, start);
  yield* Effect.promise(() =>
    expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
  );

  yield* Effect.promise(() => page.goBack({ waitUntil: "commit" }));
  yield* arrive(page, setHref, section);
  yield* Effect.promise(() => page.goBack({ waitUntil: "commit" }));
  yield* arrive(page, trackHref, visibleLink(page, setHref));
  // Late streamed content would still move the page, so keep observing.
  yield* Effect.sleep("1 second");

  const observation = yield* readShellObservation(page, since);
  yield* Effect.sync(() => {
    expect(observation.frames).toBeGreaterThan(0);
    expect(observation.hiddenFrames).toBe(0);
    expect(observation.shells).toBe(1);
    expect(observation.headinglessFrames).toBe(0);
    expect(observation.layoutShift).toBe(0);
  });
});

/**
 * Opens a set and then one of its sections while Next.js holds back
 * request-time data, so each heading has to come from the link's prefetch
 * instead of waiting for the learner's attempt.
 */
const verifyPrefetchedHeadings = Effect.fn(
  "NakafaE2E.verifyPrefetchedTryoutHeadings"
)(function* (page: Page, hasTouch: boolean) {
  yield* seedDeniedAnalyticsConsent(page);
  yield* openHub(page);
  yield* openTrack(page, hasTouch);

  const setLink = visibleLink(page, setHref);
  const setTitle = yield* Effect.promise(() =>
    setLink.locator("[title]").getAttribute("title")
  ).pipe(Effect.flatMap(Effect.fromNullishOr));
  yield* openPrefetched(page, setLink, {
    hasTouch,
    pathname: setHref,
    title: setTitle,
  });

  const section = sectionLink(page);
  yield* arrive(page, setHref, section);
  const sectionHref = yield* readSectionHref(section);
  const sectionTitle = yield* Effect.promise(() =>
    section.locator("h3").innerText()
  );
  yield* openPrefetched(page, section, {
    hasTouch,
    pathname: sectionHref,
    title: sectionTitle,
  });
});

for (const viewport of viewports) {
  test.describe(`Try-out shell on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("stays mounted and visible from the catalog to a section and back", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyTryoutShell(page, viewport.hasTouch))
      );
    });

    test("paints set and section headings from the prefetch", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          verifyPrefetchedHeadings(page, viewport.hasTouch)
        )
      );
    });
  });
}
