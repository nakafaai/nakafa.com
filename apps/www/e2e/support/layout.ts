import { expect, type Locator, type Page } from "@playwright/test";
import { Array as Arr, Effect, Number as Num } from "effect";

/**
 * Reads every layout shift the page has recorded since navigation. A buffered
 * observer holds every recorded shift as soon as it observes, so taking its
 * records reads them at once. WebKit has no Layout Instability API, so there
 * it reads none and a suite proves stability through the placement of the
 * page instead.
 */
const readLayoutShifts = Effect.fn("NakafaE2E.readLayoutShifts")(function* (
  page: Page
) {
  return yield* Effect.promise(() =>
    page.evaluate(() => {
      const observer = new PerformanceObserver(() => undefined);
      observer.observe({ buffered: true, type: "layout-shift" });
      const entries = observer.takeRecords();
      observer.disconnect();
      return entries.map((entry) => ({
        hadRecentInput:
          "hadRecentInput" in entry && entry.hadRecentInput === true,
        value:
          "value" in entry && typeof entry.value === "number" ? entry.value : 0,
      }));
    })
  );
});

/** Reads the layout shift the page has recorded since navigation. */
export const readLayoutShift = Effect.fn("NakafaE2E.readLayoutShift")(
  function* (page: Page) {
    const shifts = yield* readLayoutShifts(page);
    return Num.sumAll(Arr.map(shifts, ({ value }) => value));
  }
);

/**
 * Reads the page's cumulative layout shift since navigation: every recorded
 * shift except those within half a second of a press or key, which answer
 * that input.
 */
export const readCumulativeLayoutShift = Effect.fn(
  "NakafaE2E.readCumulativeLayoutShift"
)(function* (page: Page) {
  const shifts = yield* readLayoutShifts(page);
  return Num.sumAll(
    Arr.map(
      Arr.filter(shifts, ({ hadRecentInput }) => !hadRecentInput),
      ({ value }) => value
    )
  );
});

/**
 * Waits until a reader sees the element rather than a sticky header over it:
 * the topmost element at its center is the element itself or one inside it.
 */
export const expectUncovered = Effect.fn("NakafaE2E.expectUncovered")(
  function* (locator: Locator, timeout: number) {
    yield* Effect.promise(() =>
      expect
        .poll(
          () =>
            locator.evaluate((element) => {
              const { height, left, top, width } =
                element.getBoundingClientRect();
              return element.contains(
                element.ownerDocument.elementFromPoint(
                  left + width / 2,
                  top + height / 2
                )
              );
            }),
          { timeout }
        )
        .toBe(true)
    );
  }
);
