import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { holdChunkHolding, openRoute } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/**
 * Longer than a turn would take: a lesson that changed by itself within this
 * time would show it. The window turns only when the reader picks a tab.
 */
const LESSON_WAIT_MS = 8000;

/** How often the lesson panel's height is read once its visual is mounted. */
const HEIGHT_SAMPLE_MS = 200;

/** Enough samples to cover the wait with room to spare. */
const HEIGHT_SAMPLE_COUNT = Math.ceil(LESSON_WAIT_MS / HEIGHT_SAMPLE_MS);

/** How long the lesson visual's code is held back, so its placeholder stays on the screen. */
const LOADING_HOLD_MS = 8000;

/** The attribute that marks the control whose focus must survive a scroll. */
const FOCUS_PROBE = "data-focus-probe";

/** A translation key that only the lesson visual's code names, so its chunk is the one held. */
const LESSON_VISUAL_MARKER = "lab.atom.choose";

/** The first lesson's tab, and the view its visual names, in Indonesian. */
const PROJECTILE_VIEW = "Visual lintasan bola lontar";

/**
 * The cell lesson's tab, named by its published lesson's title, and the view its
 * visual names, in Indonesian.
 */
const CELL_TAB = "Bakteri";
const CELL_VIEW = "Model struktur bakteri";

/** The open lesson's panel of the home page's lesson window. */
function lessonPanel(page: Page) {
  return page.locator("#lesson").getByRole("tabpanel");
}

/** The tab row, which is the top of the lesson window. */
function lessonTabs(page: Page) {
  return page.locator("#lesson").getByRole("tablist");
}

/** The visual of a lesson, found by the name of its view. */
function visualNamed(page: Page, name: string) {
  return page.locator("#lesson").getByRole("region", { name });
}

test("home lesson window turns only when the reader picks a lesson", async ({
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
              const lesson = page.locator("#lesson");
              const cell = lesson.getByRole("tab", {
                exact: true,
                name: CELL_TAB,
              });
              yield* Effect.promise(() => lesson.scrollIntoViewIfNeeded());
              yield* Effect.promise(() => cell.click());
              // The pointer and the focus leave the window, so nothing holds it.
              yield* Effect.promise(() => page.mouse.move(0, 0));
              yield* Effect.promise(() =>
                page.evaluate(() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                })
              );
              yield* Effect.promise(() =>
                expect(visualNamed(page, CELL_VIEW)).toBeAttached({
                  timeout: readinessTimeoutMilliseconds,
                })
              );

              yield* Effect.promise(() => page.waitForTimeout(LESSON_WAIT_MS));
              yield* Effect.promise(() =>
                expect(lesson.getByRole("tab", { selected: true })).toHaveText(
                  CELL_TAB
                )
              );
              yield* Effect.promise(() =>
                expect(visualNamed(page, CELL_VIEW)).toBeAttached()
              );
            })
          );
        })
    )
  );
});

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
                expect(visualNamed(page, PROJECTILE_VIEW)).toBeAttached({
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
              const visual = visualNamed(page, PROJECTILE_VIEW);
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
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
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect(visualNamed(page, PROJECTILE_VIEW)).toBeAttached({
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

test("home lesson placeholder holds still with reduced motion while its visual loads", async ({
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
              // Holds the lesson visual's code, so its visual is still loading when it is checked.
              yield* holdChunkHolding(
                page,
                LESSON_VISUAL_MARKER,
                LOADING_HOLD_MS
              );
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              // The placeholder sits in an aria-hidden frame, so the role is matched in the markup.
              const spinner = page.locator("#lesson [role='status']").first();
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

test("home lesson window keeps a focused control on the page while the window is out of view", async ({
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
              const lesson = page.locator("#lesson");
              const control = lessonPanel(page).locator("button").first();
              const probe = page.locator(`[${FOCUS_PROBE}]`);

              yield* Effect.promise(() => lesson.scrollIntoViewIfNeeded());
              yield* Effect.promise(() => expect(control).toBeVisible());
              yield* Effect.promise(() =>
                control.evaluate(
                  (element, name) => element.setAttribute(name, ""),
                  FOCUS_PROBE
                )
              );
              yield* Effect.promise(() => control.focus());
              yield* Effect.promise(() => expect(probe).toBeFocused());

              // The window leaves the screen, far above, while the reader still has focus in it.
              yield* Effect.promise(() =>
                page.evaluate(() =>
                  window.scrollTo(0, document.documentElement.scrollHeight)
                )
              );
              yield* Effect.promise(() => page.waitForTimeout(500));
              yield* Effect.promise(() => expect(probe).toBeFocused());

              // The window comes back, and the control is still the one with focus.
              yield* Effect.promise(() => lesson.scrollIntoViewIfNeeded());
              yield* Effect.promise(() => expect(probe).toBeFocused());
            })
          );
        })
    )
  );
});
