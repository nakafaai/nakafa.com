import { instant } from "@next/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect, type MutableHashSet } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/context";
import { press } from "@/e2e/support/input";
import {
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  activate,
  arrive,
  intend,
  openHub,
  openTrack,
  readSectionHref,
  recordIntentRequests,
  sectionLink,
  setHref,
  settledSection,
  trackHref,
  visibleLink,
} from "@/e2e/support/tryout";
import { tryoutViewports } from "@/e2e/support/viewport";

/**
 * Opens a set or section while Next.js holds back request-time data, so its
 * heading and its catalog content have to come from the link's prefetch. The
 * learner's attempt streams in once the hold ends.
 */
const openPrefetched = Effect.fn("NakafaE2E.openPrefetchedTryoutPage")(
  function* (
    page: Page,
    link: Locator,
    target: {
      content: Locator;
      hasTouch: boolean;
      pathname: string;
      title: string;
    },
    requested: MutableHashSet.MutableHashSet<string>
  ) {
    yield* Effect.promise(() => link.scrollIntoViewIfNeeded());
    yield* intend(link, target, requested);
    // @next/playwright owns this native Promise callback while its lock is held.
    yield* Effect.promise(() =>
      instant(page, () =>
        press(link, target.hasTouch)
          // A pointer that rests where it pressed would show intent on
          // whatever the next page puts there, before the test asks for it.
          .then(() => page.mouse.move(-1, -1))
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
          .then(() =>
            expect(target.content).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            })
          )
      )
    );
  }
);

/**
 * Walks from the try-out catalog to a set and one of its sections, then back,
 * while recording every frame. The app shell must stay one mounted, visible,
 * unlocked element, every frame must show a page heading, and nothing may
 * shift.
 */
const verifyTryoutShell = Effect.fn("NakafaE2E.verifyTryoutShell")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* observeShell(page);
  yield* openHub(page);
  const since = yield* readPageTime(page);

  yield* openTrack(page, hasTouch);
  yield* activate(visibleLink(page, setHref), hasTouch);
  const section = yield* settledSection(page);
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
    expect(observation.locks).toEqual([false]);
    expect(observation.markedFrames).toBe(0);
  });
});

/**
 * Opens a set and then one of its sections while Next.js holds back
 * request-time data, so each heading, the set's section list, and the
 * section's question count and time have to come from the link's prefetch
 * instead of waiting for the learner's attempt.
 */
const verifyPrefetchedHeadings = Effect.fn(
  "NakafaE2E.verifyPrefetchedTryoutHeadings"
)(function* (page: Page, hasTouch: boolean) {
  yield* seedAnalyticsConsent(page, "denied");
  const requested = recordIntentRequests(page);
  yield* openHub(page);
  yield* openTrack(page, hasTouch);

  const setLink = visibleLink(page, setHref);
  const setTitle = yield* Effect.promise(() =>
    setLink.locator("[title]").getAttribute("title")
  ).pipe(Effect.flatMap(Effect.fromNullishOr));
  yield* openPrefetched(
    page,
    setLink,
    {
      content: sectionLink(page),
      hasTouch,
      pathname: setHref,
      title: setTitle,
    },
    requested
  );

  const section = yield* settledSection(page);
  const sectionHref = yield* readSectionHref(section);
  const sectionTitle = yield* Effect.promise(() =>
    section.locator("h3").innerText()
  );
  yield* openPrefetched(
    page,
    section,
    {
      content: page
        .locator("main")
        .getByText("Questions", { exact: true })
        .filter({ visible: true }),
      hasTouch,
      pathname: sectionHref,
      title: sectionTitle,
    },
    requested
  );
});

for (const viewport of tryoutViewports) {
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

    test("paints set and section catalog views from the prefetch", async ({
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
