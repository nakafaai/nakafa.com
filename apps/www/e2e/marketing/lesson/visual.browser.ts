import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";
import { withBrowserContext } from "@/e2e/support/context";
import {
  LESSON_WAIT_MS,
  lessonPanel,
  lessonSection,
  lessonTabs,
  lessonVisual,
} from "@/e2e/support/lesson";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { holdChunkHolding, openRoute } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import {
  desktopViewport,
  touchViewport,
  viewportSize,
} from "@/e2e/support/viewport";

/** How often the lesson panel's height is read once its visual is mounted. */
const HEIGHT_SAMPLE_MS = 200;

/** Enough samples to cover the wait with room to spare. */
const HEIGHT_SAMPLE_COUNT = Math.ceil(LESSON_WAIT_MS / HEIGHT_SAMPLE_MS);

/** How long the circle's scene is held back, so its placeholder stays on the screen. */
const LOADING_HOLD_MS = 8000;

/**
 * A marker that only the unit circle's scene draws on the home page: the slot
 * of its coordinate system. The chunk that holds it is the one held back.
 */
const CIRCLE_SCENE_MARKER = "coordinate-system";

/** The tabs of the window, in order: projectile, circle, atom and cell. */
const CIRCLE_TAB_INDEX = 1;

/** The first lesson's tab, and the view its visual names, in Indonesian. */
const PROJECTILE_VIEW = "Visual lintasan bola lontar";

/** The widths the window's height is checked at: a phone and a desktop. */
const WINDOW_VIEWPORTS = [touchViewport, desktopViewport];

/**
 * The height of the window: its tabs and the grid of its panels. Every panel
 * shares one grid cell, so the height is the one of the tallest panel.
 */
function lessonWindow(page: Page) {
  return lessonSection(page).locator('[data-slot="tabs"]');
}

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

test("home lesson window mounts its visual before the window reaches the screen", async ({
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
              // The window starts below the fold, so the visual must mount before the reader scrolls.
              const tabs = yield* Effect.promise(() =>
                lessonTabs(page).boundingBox()
              );
              expect(tabs?.y).toBeGreaterThanOrEqual(desktopViewport.height);
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
                lessonSection(page).scrollIntoViewIfNeeded()
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

test("home lesson window keeps its height once its visual is mounted", async ({
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
              const panel = lessonPanel(page);
              yield* Effect.promise(() =>
                lessonSection(page).scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect(
                  lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                ).toBeAttached({
                  timeout: readinessTimeoutMilliseconds,
                })
              );

              const heights = MutableList.make<number>();
              for (let count = 0; count < HEIGHT_SAMPLE_COUNT; count += 1) {
                const box = yield* Effect.promise(() => panel.boundingBox());
                if (box !== null) {
                  MutableList.append(heights, Math.round(box.height));
                }
                yield* Effect.promise(() =>
                  page.waitForTimeout(HEIGHT_SAMPLE_MS)
                );
              }
              expect(Arr.dedupe(MutableList.toArray(heights))).toHaveLength(1);
            })
          );
        })
    )
  );
});

for (const viewport of WINDOW_VIEWPORTS) {
  test(`home lesson window keeps its height before the reveal, after it and after each tab at ${viewport.width}px`, async ({
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
          viewport: viewportSize(viewport),
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                yield* openRoute(page, "/id", "denied");
                const root = lessonWindow(page);
                const tabs = lessonSection(page).getByRole("tab");

                // Before the reveal the open panel holds its frame, which must already be the window's height.
                const before = yield* Effect.promise(() => root.boundingBox());
                expect(before).not.toBeNull();

                yield* Effect.promise(() =>
                  lessonSection(page).scrollIntoViewIfNeeded()
                );
                yield* Effect.promise(() =>
                  expect(
                    lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                  ).toBeAttached({
                    timeout: readinessTimeoutMilliseconds,
                  })
                );
                const revealed = yield* Effect.promise(() =>
                  root.boundingBox()
                );
                expect(Math.round(revealed?.height ?? 0)).toBe(
                  Math.round(before?.height ?? -1)
                );

                const tabCount = yield* Effect.promise(() => tabs.count());
                for (let index = 0; index < tabCount; index += 1) {
                  const tab = tabs.nth(index);
                  yield* Effect.promise(() => tab.click());
                  yield* Effect.promise(() =>
                    expect(tab).toHaveAttribute("aria-selected", "true")
                  );
                  const picked = yield* Effect.promise(() =>
                    root.boundingBox()
                  );
                  expect(Math.round(picked?.height ?? 0)).toBe(
                    Math.round(before?.height ?? -1)
                  );
                }
              })
            );
          })
      )
    );
  });
}

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
                lessonSection(page).scrollIntoViewIfNeeded()
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
                lessonSection(page).scrollIntoViewIfNeeded()
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
