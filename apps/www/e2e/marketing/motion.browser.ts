import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

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

test("home holds still with reduced motion: the padlock keeps its size and the ball does not turn", async ({
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
              const padlock = page.locator("#privacy svg[class*='scale-110']");
              const ball = page
                .locator("#closing [class*='animate-thing-hop']")
                .first();

              yield* Effect.promise(() =>
                page.locator("#privacy").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() =>
                expect(padlock.first()).toBeAttached()
              );
              yield* Effect.promise(() =>
                expect
                  .poll(() =>
                    padlock
                      .first()
                      .evaluate((element) => getComputedStyle(element).scale)
                  )
                  .toBe("none")
              );

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
