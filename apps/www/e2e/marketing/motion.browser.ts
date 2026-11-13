import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitForFrames } from "@/e2e/support/quiet";
import { openRoute } from "@/e2e/support/route";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/** How far one step of a reader's scroll moves the page while a shape is sought. */
const REVEAL_STEP = 600;

/** The most steps of one pass down the page. */
const REVEAL_STEPS = 60;

/** The frames after a step by which the page's observers have answered and its toys stand in place. */
const REVEAL_FRAMES = 3;

/** How many times the reader goes down the whole page before a shape must stand on it. */
const REVEAL_PASSES = 3;

/** How long the page may take to add a shape once the reader has moved it. */
const ATTACH_MILLISECONDS = 30_000;

/** The fractions of the page's height that the reader scrolls to, top to bottom. */
const SCROLL_POSITIONS = [0, 0.25, 0.5, 0.75, 1];

/** Whether the shape's motion runs, as the browser computes it. */
function playState(shape: Locator) {
  return shape.evaluate(
    (element) => getComputedStyle(element).animationPlayState
  );
}

/**
 * Whether the shape's motion runs exactly while it is on screen. The check reads
 * the box of the picture that holds the shape, or of the loader's row for a dot.
 */
function movesOnlyOnScreen(shape: Locator) {
  return shape.evaluate((element) => {
    const picture =
      element instanceof SVGElement && element.ownerSVGElement !== null
        ? element.ownerSVGElement
        : (element.parentElement ?? element);
    const rect = picture.getBoundingClientRect();
    const onScreen =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;
    const running = getComputedStyle(element).animationPlayState === "running";
    return onScreen === running;
  });
}

/**
 * Brings `shape` on screen as a reader does: the page first moves once, which is the reading that wakes its toys, and
 * waits until the shape is in the page. Then the reader goes down the page from the top a step at a time and looks
 * once the page has drawn each step, since a toy shows only when the part beside it is drawn. A pass reads no clock,
 * so a loaded machine only takes longer.
 */
async function revealByScrolling(page: Page, shape: Locator) {
  await page.evaluate((step) => window.scrollBy(0, step), REVEAL_STEP);
  await expect(shape).toBeAttached({ timeout: ATTACH_MILLISECONDS });
  for (const _pass of Arr.range(1, REVEAL_PASSES)) {
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const _step of Arr.range(1, REVEAL_STEPS)) {
      await waitForFrames(page, REVEAL_FRAMES);
      if (await shape.isVisible()) {
        return;
      }
      const atEnd = await page.evaluate(
        () =>
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2
      );
      if (atEnd) {
        break;
      }
      await page.evaluate((step) => window.scrollBy(0, step), REVEAL_STEP);
    }
  }
  await expect(shape).toBeVisible({ timeout: 0 });
}

/** Scrolls to a fraction of the page's scrollable height. */
function scrollToFraction(page: Page, fraction: number) {
  return page.evaluate(
    (ratio) =>
      window.scrollTo(
        0,
        (document.documentElement.scrollHeight - window.innerHeight) * ratio
      ),
    fraction
  );
}

test("home toys and loaders move while they are on screen and hold still out of view", async ({
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
              // The closing ball, a stopwatch of the toy layer, and a dot of the crowd's typing bubbles.
              const shapes = [
                page.locator("#closing [class*='animate-thing-hop']").first(),
                page.locator("[class*='animate-thing-tick']").first(),
                page.locator("#community [class*='typing_1s']").first(),
              ];

              for (const shape of shapes) {
                // A toy shows once the part beside it is drawn, as the reader nears it, so the page
                // scrolls down the way a reader does until the shape stands on it.
                yield* Effect.promise(() => revealByScrolling(page, shape));
                yield* Effect.promise(() => shape.scrollIntoViewIfNeeded());
                yield* Effect.promise(() =>
                  expect.poll(() => playState(shape)).toBe("running")
                );
              }

              for (const fraction of SCROLL_POSITIONS) {
                yield* Effect.promise(() => scrollToFraction(page, fraction));
                for (const shape of shapes) {
                  yield* Effect.promise(() =>
                    expect.poll(() => movesOnlyOnScreen(shape)).toBe(true)
                  );
                }
              }
            })
          );
        })
    )
  );
});

test("home holds still with reduced motion: the ball does not turn", async ({
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
              const ball = page
                .locator("#closing [class*='animate-thing-hop']")
                .first();

              yield* Effect.promise(() =>
                page.locator("#closing").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect
                  .poll(() =>
                    ball.evaluate(
                      (element) => getComputedStyle(element).animationName
                    )
                  )
                  .toBe("none")
              );
            })
          );
        })
    )
  );
});
