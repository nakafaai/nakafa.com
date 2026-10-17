import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { LAB_VISIBLE_SHARE } from "@/components/marketing/about/lesson/reveal";
import { withBrowserContext } from "@/e2e/support/context";
import {
  LESSON_WAIT_MS,
  lessonPanel,
  lessonSection,
  lessonVisual,
  lessonWindow,
  PROJECTILE_VIEW,
  visibleShare,
} from "@/e2e/support/lesson";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/** The attribute that marks the control whose focus must survive a scroll. */
const FOCUS_PROBE = "data-focus-probe";

/**
 * The tabs of the first two lessons and of the cell lesson, named by their
 * subjects, and the view the cell's visual names, in Indonesian.
 */
const PHYSICS_TAB = "Fisika";
const MATHEMATICS_TAB = "Matematika";
const CELL_TAB = "Biologi";
const CELL_VIEW = "Model struktur bakteri";

test("home lesson window opens the next lesson by itself while it is on screen", async ({
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
              const selected = lesson.getByRole("tab", { selected: true });
              yield* Effect.promise(() =>
                lessonWindow(page).scrollIntoViewIfNeeded()
              );
              // Nothing points at the window or holds the focus in it.
              yield* Effect.promise(() => page.mouse.move(0, 0));
              yield* Effect.promise(() =>
                expect(selected).toHaveText(PHYSICS_TAB)
              );
              yield* Effect.promise(() =>
                expect(selected).toHaveText(MATHEMATICS_TAB, {
                  timeout: LESSON_WAIT_MS,
                })
              );
            })
          );
        })
    )
  );
});

test("home lesson window stops turning once the reader picks a lesson", async ({
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

test("home lesson window shows the text and the scene of its open card before its lab mounts", async ({
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
              // Less than half of the window is on the screen, so nothing has mounted its lab.
              const share = visibleShare(
                yield* Effect.promise(() => lessonWindow(page).boundingBox()),
                desktopViewport.height
              );
              expect(share).toBeLessThan(LAB_VISIBLE_SHARE);
              yield* Effect.promise(() =>
                expect(
                  lessonVisual(page, PROJECTILE_VIEW).locator("canvas")
                ).toHaveCount(0)
              );

              const card = lessonPanel(page).locator(
                '[data-slot="visual-card"]'
              );
              yield* Effect.promise(() => expect(card).toHaveCount(1));
              // An inert ancestor hides its whole subtree from assistive technology.
              const exposure = yield* Effect.promise(() =>
                card.evaluate((element) => {
                  const hidden = (node: Element) =>
                    node.closest("[inert]") !== null;
                  const buttons = Array.from(
                    element.querySelectorAll("button")
                  );
                  const facts = Array.from(element.querySelectorAll("dt"));
                  const scene = element.querySelector("section[aria-label]");
                  return {
                    cardHidden: hidden(element),
                    controls: buttons.length,
                    controlsHidden: buttons.length > 0 && buttons.every(hidden),
                    facts: facts.length,
                    factsHidden: facts.some(hidden),
                    sceneHidden: scene !== null && hidden(scene),
                    sceneName: scene?.getAttribute("aria-label") ?? null,
                  };
                })
              );

              expect(exposure.cardHidden).toBe(false);
              expect(exposure.facts).toBeGreaterThan(0);
              expect(exposure.factsHidden).toBe(false);
              expect(exposure.sceneName).toBe(PROJECTILE_VIEW);
              expect(exposure.sceneHidden).toBe(false);
              expect(exposure.controls).toBeGreaterThan(0);
              expect(exposure.controlsHidden).toBe(true);
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
