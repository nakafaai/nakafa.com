import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";
import { LAB_VISIBLE_SHARE } from "@/components/marketing/about/lesson/reveal";
import { withBrowserContext } from "@/e2e/support/context";
import {
  lessonPanel,
  lessonSection,
  lessonVisual,
  lessonWindow,
  PROJECTILE_VIEW,
  visibleShare,
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

/** How far either side of the half the edge test sets the window's share. */
const EDGE_STEP = 0.01;

/** The share of the window that lies on the screen now. */
function windowShare(root: Locator) {
  return Effect.promise(async () =>
    visibleShare(await root.boundingBox(), desktopViewport.height)
  );
}

/** Checks that the window shows the share that its scroll aimed for, to within 0.005. */
function expectWindowShare(root: Locator, share: number) {
  return Effect.promise(async () => {
    const measured = visibleShare(
      await root.boundingBox(),
      desktopViewport.height
    );
    expect(measured).toBeCloseTo(share, 2);
  });
}

/** The most scrolls that setting the window's share takes. */
const SHARE_SCROLLS = 6;

/** How close, in pixels, the window's top must come to where the share begins. */
const SHARE_TOLERANCE_PX = 0.5;

/**
 * Scrolls the page at once until `share` of the window's height lies on the
 * screen. The window rises into place as the page scrolls, so one scroll aimed
 * from where it stood lands a little off: each scroll waits two frames for the
 * rise to follow, then aims again from where the window now stands, and the
 * share settles within a few scrolls.
 */
function scrollWindowToShare(page: Page, root: Locator, share: number) {
  return Effect.promise(async () => {
    for (let scroll = 0; scroll < SHARE_SCROLLS; scroll++) {
      const box = await root.boundingBox();
      expect(box).not.toBeNull();
      const top = desktopViewport.height - share * (box?.height ?? 0);
      const distance = (box?.y ?? 0) - top;
      if (Math.abs(distance) < SHARE_TOLERANCE_PX) {
        return;
      }
      await page.evaluate(
        (by) =>
          new Promise<void>((resolve) => {
            window.scrollBy({ behavior: "instant", top: by });
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
        distance
      );
    }
  });
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
              const visual = lessonVisual(page, PROJECTILE_VIEW).locator(
                "canvas"
              );

              // Under half of the window is on the screen, so the server's card is still the visual.
              expect(yield* windowShare(root)).toBeLessThan(LAB_VISIBLE_SHARE);
              yield* Effect.promise(() => expect(visual).toHaveCount(0));

              // Just short of half, the observer has not crossed the share, so the lab still waits.
              yield* scrollWindowToShare(
                page,
                root,
                LAB_VISIBLE_SHARE - EDGE_STEP
              );
              yield* expectWindowShare(root, LAB_VISIBLE_SHARE - EDGE_STEP);
              yield* Effect.promise(() => page.waitForTimeout(500));
              yield* Effect.promise(() => expect(visual).toHaveCount(0));

              // Just past half, the observer crosses the share and the lab mounts.
              yield* scrollWindowToShare(
                page,
                root,
                LAB_VISIBLE_SHARE + EDGE_STEP
              );
              yield* expectWindowShare(root, LAB_VISIBLE_SHARE + EDGE_STEP);
              yield* Effect.promise(() =>
                expect(visual).toBeAttached({
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
                  .locator('[data-slot="button-group"]')
                  .getByRole("button")
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
