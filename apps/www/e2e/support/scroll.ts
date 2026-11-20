import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { waitForFrames } from "@/e2e/support/quiet";

/** How far one step down a long page scrolls, and the most steps of one pass. */
const STEP_PIXELS = 300;
const STEPS = 60;

/** How many times a reader goes down the page from the top before the control must stand on screen. */
const PASSES = 3;

/**
 * The frames after a scroll that its intersection observers have answered by:
 * the browser runs them after the frame that drew the scroll.
 */
const OBSERVED_FRAMES = 3;

/**
 * Whether the control is in the page and on screen. A control the page adds only once its part is
 * drawn may not be in the page yet, so its count is read first, which waits for nothing.
 */
const isOnScreen = Effect.fn("NakafaE2E.isOnScreen")(function* (
  control: Locator,
  height: number
) {
  const count = yield* Effect.promise(() => control.count());
  if (count === 0) {
    return false;
  }
  const box = yield* Effect.promise(() => control.boundingBox());
  return box !== null && box.y > 0 && box.y + box.height < height;
});

/** Whether the page is scrolled to its end. */
const isAtPageEnd = (page: Page) =>
  Effect.promise(() =>
    page.evaluate(
      () =>
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2
    )
  );

/** Scrolls the page by `top` pixels and waits until it drew the step and its observers answered. */
const scrollStep = Effect.fn("NakafaE2E.scrollStep")(function* (
  page: Page,
  top: number
) {
  yield* Effect.promise(() =>
    page.evaluate((offset) => window.scrollBy(0, offset), top)
  );
  yield* Effect.promise(() => waitForFrames(page, OBSERVED_FRAMES));
});

/**
 * Scrolls a control of a long page to the screen step by step, as a reader does. WebKit's
 * `scrollIntoView`, which a click uses, does nothing for an element in a section that
 * `content-visibility` still skips, and mobile WebKit has no mouse wheel, so the page scrolls itself.
 * A control the page adds only once the part beside it is drawn, such as a toy the reading wakes,
 * comes as the reader moves: each pass goes down the page until the control stands on screen or
 * the page ends, and the next starts again from the top. A pass reads no clock, so a loaded machine
 * only takes longer.
 */
export const stepTo = Effect.fn("NakafaE2E.stepTo")(function* (
  page: Page,
  control: Locator
) {
  const height = yield* Effect.promise(() =>
    page.evaluate(() => window.innerHeight)
  );
  for (const pass of Arr.range(1, PASSES)) {
    if (pass > 1) {
      yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 0)));
      yield* Effect.promise(() => waitForFrames(page, OBSERVED_FRAMES));
    }
    for (const _ of Arr.range(1, STEPS)) {
      if (yield* isOnScreen(control, height)) {
        return;
      }
      if (yield* isAtPageEnd(page)) {
        break;
      }
      yield* scrollStep(page, STEP_PIXELS);
    }
  }
  yield* Effect.promise(() => expect(control).toBeInViewport({ timeout: 0 }));
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
