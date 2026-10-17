import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";
import { withBrowserContext } from "@/e2e/support/context";
import {
  lessonPanel,
  lessonSection,
  lessonVisual,
  lessonWindow,
  PROJECTILE_VIEW,
} from "@/e2e/support/lesson";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { holdChunkHolding, openRoute } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/** How long the circle's scene is held back, so its placeholder stays on the screen. */
const LOADING_HOLD_MS = 8000;

/**
 * A marker that only the unit circle's scene draws on the home page: the slot
 * of its coordinate system. The chunk that holds it is the one held back.
 */
const CIRCLE_SCENE_MARKER = "coordinate-system";

/** The tab of the circle lesson, the second of the window's tabs. */
const CIRCLE_TAB_INDEX = 1;

/**
 * Counts the layout shifts that moved something inside the lesson section and
 * that no input caused. A buffered observer holds every shift since navigation,
 * so the count grows exactly when a shift is recorded during the check.
 */
function countSectionShifts(page: Page) {
  return page.evaluate((sectionId) => {
    const observer = new PerformanceObserver(() => undefined);
    observer.observe({ buffered: true, type: "layout-shift" });
    const entries = observer.takeRecords();
    observer.disconnect();
    const section = document.getElementById(sectionId);
    return entries.filter((entry) => {
      const sources = Array.from<{ node: unknown }>(
        Reflect.get(entry, "sources") ?? []
      );
      return (
        Reflect.get(entry, "hadRecentInput") === false &&
        section !== null &&
        sources.some(
          (source) =>
            source.node instanceof Node && section.contains(source.node)
        )
      );
    }).length;
  }, LESSON_SECTION_ID);
}

/** The share of a box that lies inside the viewport, from 0 to 1. */
function visibleShare(
  box: Awaited<ReturnType<Locator["boundingBox"]>>,
  viewportHeight: number
) {
  if (box === null || box.height <= 0) {
    return 0;
  }
  const visible =
    Math.min(box.y + box.height, viewportHeight) - Math.max(box.y, 0);
  return Math.max(0, visible) / box.height;
}

test("home lesson window mounts its visual once half of the window is on the screen", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "no-preference",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() => page.waitForLoadState("load"));
              const root = lessonWindow(page);
              const box = yield* Effect.promise(() => root.boundingBox());
              expect(box).not.toBeNull();
              // Under half of the window is on the screen, so the server's card is still the visual.
              expect(visibleShare(box, desktopViewport.height)).toBeLessThan(
                0.5
              );
              yield* Effect.promise(() =>
                expect(
                  lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                ).toHaveCount(0)
              );

              yield* Effect.promise(() => root.scrollIntoViewIfNeeded());
              yield* Effect.promise(() =>
                expect(
                  lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                ).toBeAttached({
                  timeout: readinessTimeoutMilliseconds,
                })
              );
            })
          );
        })
    )
  );
});

test("home lesson window keeps its visual mounted once the window has left the screen", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "no-preference",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              const visual = lessonVisual(page, PROJECTILE_VIEW).locator(
                "canvas"
              );
              yield* Effect.promise(() =>
                lessonWindow(page).scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect(visual).toBeAttached({
                  timeout: readinessTimeoutMilliseconds,
                })
              );

              // The page ends far below the window, so the visual is far above the screen.
              yield* Effect.promise(() =>
                page.evaluate(() =>
                  window.scrollTo(0, document.documentElement.scrollHeight)
                )
              );
              yield* Effect.promise(() => page.waitForTimeout(500));
              const box = yield* Effect.promise(() => visual.boundingBox());
              expect(box?.y).toBeLessThan(0);
              yield* Effect.promise(() => expect(visual).toBeAttached());
            })
          );
        })
    )
  );
});

test("home lesson window draws no layout shift in its section while it is revealed", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "no-preference",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() => page.waitForLoadState("load"));
              const shiftsBefore = yield* Effect.promise(() =>
                countSectionShifts(page)
              );

              yield* Effect.promise(() =>
                lessonWindow(page).scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect(
                  lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                ).toBeAttached({
                  timeout: readinessTimeoutMilliseconds,
                })
              );
              yield* Effect.promise(() => page.waitForTimeout(500));

              const shiftsAfter = yield* Effect.promise(() =>
                countSectionShifts(page)
              );
              expect(shiftsAfter).toBe(shiftsBefore);
            })
          );
        })
    )
  );
});

test("home lesson placeholder holds still with reduced motion while its scene loads", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              // Holds the unit circle's scene, so its placeholder is still loading when it is checked.
              yield* holdChunkHolding(
                page,
                CIRCLE_SCENE_MARKER,
                LOADING_HOLD_MS
              );
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() =>
                lessonWindow(page).scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect(
                  lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                ).toBeAttached({
                  timeout: readinessTimeoutMilliseconds,
                })
              );
              yield* Effect.promise(() =>
                lessonSection(page)
                  .getByRole("tab")
                  .nth(CIRCLE_TAB_INDEX)
                  .click()
              );
              // The placeholder sits in an aria-hidden frame, so the role is matched in the markup.
              const spinner = lessonPanel(page)
                .locator("[aria-hidden='true'] [role='status']")
                .first();
              yield* Effect.promise(() => expect(spinner).toBeVisible());
              const animation = yield* Effect.promise(() =>
                spinner.evaluate(
                  (element) => getComputedStyle(element).animationName
                )
              );
              expect(animation).toBe("none");
            })
          );
        })
    )
  );
});
