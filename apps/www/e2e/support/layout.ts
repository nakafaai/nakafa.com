import type { Page } from "@playwright/test";
import { Effect } from "effect";

/**
 * Reads the layout shift the page has recorded since navigation. Buffered
 * entries replay every shift, and a page with none never calls the observer
 * back, so the reading resolves to zero after a second.
 */
export const readLayoutShift = Effect.fn("NakafaE2E.readLayoutShift")(
  function* (page: Page) {
    return yield* Effect.promise(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            new PerformanceObserver((list) => {
              let total = 0;
              for (const entry of list.getEntries()) {
                if ("value" in entry && typeof entry.value === "number") {
                  total += entry.value;
                }
              }
              resolve(total);
            }).observe({ buffered: true, type: "layout-shift" });
            setTimeout(() => resolve(0), 1000);
          })
      )
    );
  }
);
