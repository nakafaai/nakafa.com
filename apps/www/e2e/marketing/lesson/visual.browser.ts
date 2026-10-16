import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import {
  LESSON_WAIT_MS,
  lessonPanel,
  lessonTabs,
  lessonVisual,
} from "@/e2e/support/lesson";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { holdChunkHolding, openRoute } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/** How often the lesson panel's height is read once its visual is mounted. */
const HEIGHT_SAMPLE_MS = 200;

/** Enough samples to cover the wait with room to spare. */
const HEIGHT_SAMPLE_COUNT = Math.ceil(LESSON_WAIT_MS / HEIGHT_SAMPLE_MS);

/** How long the lesson visual's code is held back, so its placeholder stays on the screen. */
const LOADING_HOLD_MS = 8000;

/** A translation key that only the lesson visual's code names, so its chunk is the one held. */
const LESSON_VISUAL_MARKER = "lab.atom.choose";

/** The first lesson's tab, and the view its visual names, in Indonesian. */
const PROJECTILE_VIEW = "Visual lintasan bola lontar";

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
                expect(lessonVisual(page, PROJECTILE_VIEW)).toBeAttached({
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
              const visual = lessonVisual(page, PROJECTILE_VIEW);
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
                expect(lessonVisual(page, PROJECTILE_VIEW)).toBeAttached({
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
