import { expect, type Page, type Route, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { NEXT_CHUNK_PATH, openRoute } from "@/e2e/support/route";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/**
 * Long enough for a lesson to stay open for its full turn after it reaches the
 * screen, with room for the observer to see it. A lesson opens its next one
 * after six seconds.
 */
const LESSON_TURN_MS = 8000;

/** How often the lesson panel's height is read while the window mounts and turns. */
const HEIGHT_SAMPLE_MS = 200;

/** Enough samples to cover the mount and one full turn, with room to spare. */
const HEIGHT_SAMPLE_COUNT = Math.ceil(
  (LESSON_TURN_MS + 2000) / HEIGHT_SAMPLE_MS
);

/** How long the lesson's code is held back, so its placeholder stays on the screen. */
const LOADING_HOLD_MS = 8000;

/** The attribute that marks the control whose focus must survive a scroll. */
const FOCUS_PROBE = "data-focus-probe";

/** The open lesson's panel of the home page's lesson window. */
function lessonPanel(page: Page) {
  return page.locator("#lesson").getByRole("tabpanel");
}

/** Lets one chunk through after the hold, so the lesson's visual waits on its placeholder. */
function holdChunk(route: Route) {
  return Effect.runPromise(
    Effect.flatMap(Effect.sleep(LOADING_HOLD_MS), () =>
      Effect.promise(() => route.continue())
    )
  );
}

test("home page holds still with reduced motion", async ({
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
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() => page.waitForTimeout(LESSON_TURN_MS));
              const selected = page
                .locator("#lesson")
                .getByRole("tab", { selected: true });
              yield* Effect.promise(() =>
                expect(selected).toHaveText("Gerak parabola")
              );
            })
          );
        })
    )
  );
});

test("home page opens the next lesson by itself while the lessons are on screen", async ({
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
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() => page.waitForTimeout(LESSON_TURN_MS));
              const selected = page
                .locator("#lesson")
                .getByRole("tab", { selected: true });
              yield* Effect.promise(() =>
                expect(selected).toHaveText("Fungsi kuadrat")
              );
            })
          );
        })
    )
  );
});

test("home lesson window keeps its height when its visual mounts and when the lesson turns", async ({
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
              const heights = MutableList.make<number>();
              const sample = Effect.fn("NakafaE2E.sampleLessonHeight")(
                function* () {
                  const box = yield* Effect.promise(() => panel.boundingBox());
                  if (box !== null) {
                    MutableList.append(heights, Math.round(box.height));
                  }
                  yield* Effect.promise(() =>
                    page.waitForTimeout(HEIGHT_SAMPLE_MS)
                  );
                }
              );

              // The reader scrolls the window in, so its visual mounts; then it turns.
              yield* sample();
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              for (let count = 0; count < HEIGHT_SAMPLE_COUNT; count += 1) {
                yield* sample();
              }

              yield* Effect.promise(() =>
                expect(panel.locator("button").first()).toBeVisible()
              );
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
              yield* openRoute(page, "/id", "denied");
              // Holds each chunk the scroll asks for, so the lesson's visual is still loading when it is checked.
              yield* Effect.promise(() =>
                page.route(NEXT_CHUNK_PATH, holdChunk)
              );
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

              // The window leaves the viewport while the reader still has focus in it.
              yield* Effect.promise(() =>
                page.evaluate(() => window.scrollTo(0, 0))
              );
              yield* Effect.promise(() => page.waitForTimeout(500));
              yield* Effect.promise(() => expect(probe).toBeFocused());

              // The window comes back and the reader leaves the control: the window counts again.
              yield* Effect.promise(() => lesson.scrollIntoViewIfNeeded());
              yield* Effect.promise(() => expect(control).toBeVisible());
              yield* Effect.promise(() =>
                page.evaluate(() => {
                  if (document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                })
              );
              yield* Effect.promise(() => page.waitForTimeout(LESSON_TURN_MS));
              const selected = lesson.getByRole("tab", { selected: true });
              yield* Effect.promise(() =>
                expect(selected).toHaveText("Fungsi kuadrat")
              );
            })
          );
        })
    )
  );
});
