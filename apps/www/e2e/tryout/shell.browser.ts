import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect, type MutableList } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { activate, press, visibleLink } from "@/e2e/support/input";
import { pressPreloaded } from "@/e2e/support/navigation/prefetch";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitForQuiet } from "@/e2e/support/quiet";
import { recordDataRequests } from "@/e2e/support/requests";
import {
  expectStillShell,
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  arrive,
  intend,
  onPath,
  openHub,
  openSetPane,
  openTrack,
  paneSectionLink,
  readSectionHref,
  setHref,
  trackHref,
} from "@/e2e/support/tryout";
import { tryoutViewports } from "@/e2e/support/viewport";

/**
 * Opens a section from a link that the reader showed intent toward, so
 * its heading and its catalog content come from the router's preload. The
 * learner's attempt streams in after the page shows.
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
    calls: MutableList.MutableList<string>
  ) {
    yield* Effect.promise(() => link.scrollIntoViewIfNeeded());
    yield* intend(link, target, calls);
    yield* pressPreloaded(
      page,
      link,
      target.hasTouch,
      Effect.promise(() =>
        press(link, target.hasTouch, { noWaitAfter: true })
          // A pointer that rests where it pressed would show intent on
          // whatever the next page puts there, before the test asks for it.
          .then(() => page.mouse.move(-1, -1))
      ),
      Effect.promise(() =>
        page
          .waitForURL((url) => url.pathname === target.pathname, {
            timeout: readinessTimeoutMilliseconds,
          })
          .then(() =>
            expect(page.getByRole("heading", { level: 1 })).toHaveAttribute(
              "title",
              target.title,
              {
                timeout: readinessTimeoutMilliseconds,
              }
            )
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
  yield* Effect.promise(() => waitForQuiet(page));
  const catalog = yield* readShellObservation(page, since);
  yield* Effect.sync(() => expectStillShell(catalog, [false]));

  // A set the visitor has not started opens beside the table, and its parts link to their pages. The pane takes
  // the page's right side at the press, which moves the page's column by design, so the walk is observed again
  // from the open pane.
  yield* openSetPane(page, hasTouch);
  yield* Effect.promise(() => waitForQuiet(page));
  const fromPane = yield* readPageTime(page);
  const section = paneSectionLink(page);
  const sectionHref = yield* readSectionHref(section);
  yield* activate(section, hasTouch);
  const start = page.getByRole("button", { exact: true, name: "Start" });
  yield* arrive(page, onPath(sectionHref), start);
  yield* Effect.promise(() =>
    expect(start).toBeEnabled({ timeout: readinessTimeoutMilliseconds })
  );

  yield* Effect.promise(() => page.goBack({ waitUntil: "commit" }));
  yield* arrive(page, onPath(trackHref), visibleLink(page, setHref, "main"));
  // Late streamed content would still move the page, so keep observing until it goes quiet.
  yield* Effect.promise(() => waitForQuiet(page));

  const observation = yield* readShellObservation(page, fromPane);
  yield* Effect.sync(() => expectStillShell(observation, [false]));
});

/**
 * Opens a section from its card in the set's pane, a link that the reader showed intent toward, so its heading and
 * its question count and time come from the router's preload instead of waiting for the learner's attempt. A set
 * nobody has started opens beside the track's table, so its own page is no step on the way.
 */
const verifyPrefetchedHeadings = Effect.fn(
  "NakafaE2E.verifyPrefetchedTryoutHeadings"
)(function* (page: Page, hasTouch: boolean) {
  yield* seedAnalyticsConsent(page, "denied");
  // Each press reads the frames that the recorder keeps, so it starts with the page.
  yield* observeShell(page);
  const requested = recordDataRequests(page);
  yield* openHub(page);
  yield* openTrack(page, hasTouch);
  yield* openSetPane(page, hasTouch);

  const section = paneSectionLink(page);
  const sectionHref = yield* readSectionHref(section);
  const sectionTitle = yield* Effect.promise(() =>
    section.locator("[title]").getAttribute("title")
  ).pipe(Effect.flatMap(Effect.fromNullishOr));
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

    test("paints a section's catalog view from the prefetch, opened from the set's pane", async ({
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
