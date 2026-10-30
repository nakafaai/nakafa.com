import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport } from "@/e2e/support/viewport";

/** A toy of a marketing page, as the toy layer draws it. */
const TOY = '[class*="group/toy"]';

/** How many of the toys stand on the first screen, shown and placed. */
const countOnScreen = (toys: Element[]) =>
  toys.filter((toy) => {
    const box = toy.getBoundingClientRect();
    return (
      box.width > 0 &&
      box.bottom > 0 &&
      box.top < window.innerHeight &&
      getComputedStyle(toy).visibility === "visible"
    );
  }).length;

test.use({
  viewport: { height: desktopViewport.height, width: desktopViewport.width },
});

/**
 * The toys of the home and pricing pages come on screen with the page. The
 * reader neither scrolls nor moves the pointer here, and a toy still stands in
 * the first screen of each page.
 */
for (const path of ["/en", "/en/pricing"]) {
  test(`the toys of ${path} show at load, before any scroll or pointer`, async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* loadMarketingPage(page, path);
          // A toy further down may come first in the page, so any toy on the first screen counts.
          yield* Effect.promise(() =>
            expect
              .poll(() => page.locator(TOY).evaluateAll(countOnScreen), {
                timeout: readinessTimeoutMilliseconds,
              })
              .toBeGreaterThan(0)
          );
          yield* Effect.promise(() =>
            expect(page.evaluate(() => window.scrollY)).resolves.toBe(0)
          );
        })
      )
    );
  });
}
