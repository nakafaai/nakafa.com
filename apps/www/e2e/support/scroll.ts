import type { Locator, Page } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { waitForFrames } from "@/e2e/support/quiet";

/** How far one step down a long page scrolls, and the most steps it takes. */
const STEP_PIXELS = 300;
const STEPS = 60;

/**
 * The frames after a scroll that its intersection observers have answered by:
 * the browser runs them after the frame that drew the scroll.
 */
const OBSERVED_FRAMES = 3;

/**
 * Scrolls a control of a long page to the screen step by step, as a reader does. WebKit's
 * `scrollIntoView`, which a click uses, does nothing for an element in a section that
 * `content-visibility` still skips, and mobile WebKit has no mouse wheel, so the page scrolls itself.
 */
export const stepTo = Effect.fn("NakafaE2E.stepTo")(function* (
  page: Page,
  control: Locator
) {
  const height = yield* Effect.promise(() =>
    page.evaluate(() => window.innerHeight)
  );
  for (const _ of Arr.range(1, STEPS)) {
    const box = yield* Effect.promise(() => control.boundingBox());
    if (box !== null && box.y > 0 && box.y + box.height < height) {
      return;
    }
    yield* Effect.promise(() =>
      page.evaluate((top) => window.scrollBy(0, top), STEP_PIXELS)
    );
    // The step is read once the page drew it and its observers answered.
    yield* Effect.promise(() => waitForFrames(page, OBSERVED_FRAMES));
  }
});

/**
 * Scrolls the whole page one screen at a time, so every part reaches the
 * viewport and every observer runs, then returns to the top.
 */
export const scrollThroughPage = Effect.fn("NakafaE2E.scrollThroughPage")(
  function* (page: Page) {
    const height = yield* Effect.promise(() =>
      page.evaluate(() => window.innerHeight)
    );
    const documentHeight = yield* Effect.promise(() =>
      page.evaluate(() => document.documentElement.scrollHeight)
    );
    for (
      let offset = 0;
      offset < documentHeight;
      offset += Math.round(height * 0.8)
    ) {
      yield* Effect.promise(() =>
        page.evaluate((top) => window.scrollTo(0, top), offset)
      );
      yield* Effect.promise(() => waitForFrames(page, OBSERVED_FRAMES));
    }
    yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 0)));
  }
);
