import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withBrowserContext } from "../../support/context";
import { lessonPanel, lessonSection } from "../../support/lesson";
import { withObservedPageErrors } from "../../support/observe";
import { openRoute } from "../../support/route";
import { readinessTimeoutMilliseconds } from "../../support/timeout";
import { desktopViewport, viewportSize } from "../../support/viewport";

/** The window's tab of each lab that the reduced-motion check opens, in the window's order. */
const PROJECTILE_TAB_INDEX = 0;
const ATOM_TAB_INDEX = 2;
const CELL_TAB_INDEX = 3;

/** How long the scene is left between its two captures, so a running frame loop would move it. */
const STILL_WAIT_MS = 800;

/**
 * With reduced motion a lab's scene is drawn on demand, so after its first frame
 * the canvas holds the same pixels: a second capture a moment later matches the
 * first. The captures are screenshots, because a WebGL canvas reads back blank
 * after its frame unless it keeps its buffer.
 */
const expectSceneStill = Effect.fn("NakafaE2E.expectSceneStill")(function* (
  page: Page,
  tabIndex: number
) {
  yield* Effect.promise(() =>
    lessonSection(page)
      .locator('[data-slot="button-group"]')
      .getByRole("button")
      .nth(tabIndex)
      .click()
  );
  const canvas = lessonPanel(page).locator("canvas").first();
  yield* Effect.promise(() =>
    expect(canvas).toBeAttached({ timeout: readinessTimeoutMilliseconds })
  );
  const first = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.promise(() => page.waitForTimeout(STILL_WAIT_MS));
  const second = yield* Effect.promise(() => canvas.screenshot());
  expect(second.equals(first)).toBe(true);
});

/** Opens the home page with reduced motion and the lesson window in view. */
const openReducedLesson = Effect.fn("NakafaE2E.openReducedLesson")(function* (
  page: Page
) {
  yield* openRoute(page, "/id", "denied");
  yield* Effect.promise(() => lessonSection(page).scrollIntoViewIfNeeded());
});

/** Registers the reduced-motion check of one home lab, opened at its tab. */
function testReducedLab(name: string, tabIndex: number) {
  test(`home lesson ${name} lab holds its scene still with reduced motion`, async ({
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
                yield* openReducedLesson(page);
                yield* expectSceneStill(page, tabIndex);
              })
            );
          })
      )
    );
  });
}

testReducedLab("projectile", PROJECTILE_TAB_INDEX);
testReducedLab("atom", ATOM_TAB_INDEX);
testReducedLab("cell", CELL_TAB_INDEX);
