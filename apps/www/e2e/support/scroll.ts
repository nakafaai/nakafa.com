import type { Page } from "@playwright/test";
import { Effect } from "effect";

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
