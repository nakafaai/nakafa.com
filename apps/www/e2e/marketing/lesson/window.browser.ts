import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import {
  LESSON_WAIT_MS,
  lessonPanel,
  lessonSection,
  lessonVisual,
  lessonWindow,
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
              const lesson = lessonSection(page);
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
                expect(
                  lessonVisual(page, CELL_VIEW).locator("canvas")
                ).toBeAttached({
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
                expect(
                  lessonVisual(page, CELL_VIEW).locator("canvas")
                ).toBeAttached()
              );
            })
          );
        })
    )
  );
});

/** The tabs of the projectile and circle lessons, in the window's order. */
const PROJECTILE_TAB_INDEX = 0;
const CIRCLE_TAB_INDEX = 1;

/** The toggle of the high-angle launch, the third of the projectile card's launches. */
const HIGH_ANGLE_TOGGLE_INDEX = 2;

test("home lesson window keeps the launch the reader picked when the reader returns to it", async ({
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
              const lesson = lessonSection(page);
              const tabs = lesson.getByRole("tab");
              const launch = lessonPanel(page)
                .locator('[data-slot="toggle-group-item"]')
                .nth(HIGH_ANGLE_TOGGLE_INDEX);
              yield* Effect.promise(() =>
                lessonWindow(page).scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect(
                  lessonPanel(page).locator("canvas").first()
                ).toBeAttached({ timeout: readinessTimeoutMilliseconds })
              );
              yield* Effect.promise(() => launch.click());
              yield* Effect.promise(() =>
                expect(launch).toHaveAttribute("aria-pressed", "true")
              );

              // The circle's lab replaces the projectile's, and the projectile's lab mounts again.
              yield* Effect.promise(() => tabs.nth(CIRCLE_TAB_INDEX).click());
              yield* Effect.promise(() =>
                tabs.nth(PROJECTILE_TAB_INDEX).click()
              );
              yield* Effect.promise(() =>
                expect(launch).toHaveAttribute("aria-pressed", "true", {
                  timeout: readinessTimeoutMilliseconds,
                })
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
              const lesson = lessonSection(page);
              const probe = page.locator(`[${FOCUS_PROBE}]`);

              yield* Effect.promise(() =>
                lessonWindow(page).scrollIntoViewIfNeeded()
              );
              // The lab replaces the card, so the control is taken once the lab is mounted and stays mounted.
              yield* Effect.promise(() =>
                expect(
                  lessonPanel(page).locator("canvas").first()
                ).toBeAttached({ timeout: readinessTimeoutMilliseconds })
              );
              const control = lessonPanel(page).locator("button").first();
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
