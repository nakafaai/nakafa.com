import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import {
  LESSON_WAIT_MS,
  lessonPanel,
  lessonVisual,
} from "@/e2e/support/lesson";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/** The attribute that marks the control whose focus must survive a scroll. */
const FOCUS_PROBE = "data-focus-probe";

/**
 * The cell lesson's tab, named by its published lesson's title, and the view its
 * visual names, in Indonesian.
 */
const CELL_TAB = "Bakteri";
const CELL_VIEW = "Model struktur bakteri";

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
                expect(lessonVisual(page, CELL_VIEW)).toBeAttached({
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
                expect(lessonVisual(page, CELL_VIEW)).toBeAttached()
              );
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
