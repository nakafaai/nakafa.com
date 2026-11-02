import type { Locator, Page } from "@playwright/test";
import { Array as Arr, Effect } from "effect";

/** How far one turn of the wheel scrolls, and the most turns a long page takes. */
const WHEEL_PIXELS = 300;
const WHEEL_TURNS = 60;

/**
 * Scrolls a control of a long page to the screen with the wheel, as a reader does. WebKit's
 * `scrollIntoView`, which a click uses, does nothing for an element in a section that
 * `content-visibility` still skips, though the wheel reaches it.
 */
export const wheelTo = Effect.fn("NakafaE2E.wheelTo")(function* (
  page: Page,
  control: Locator
) {
  const height = yield* Effect.promise(() =>
    page.evaluate(() => window.innerHeight)
  );
  yield* Effect.promise(() => page.mouse.move(100, 100));
  for (const _ of Arr.range(1, WHEEL_TURNS)) {
    const box = yield* Effect.promise(() => control.boundingBox());
    if (box !== null && box.y > 0 && box.y + box.height < height) {
      return;
    }
    yield* Effect.promise(() => page.mouse.wheel(0, WHEEL_PIXELS));
    yield* Effect.promise(() => page.waitForTimeout(50));
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
      yield* Effect.promise(() => page.waitForTimeout(120));
    }
    yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 0)));
  }
);
