import { expect, type Locator, type Page } from "@playwright/test";
import { Array as Arr, Effect, Number as Num } from "effect";

/**
 * Records, from the first script on, the start time and value of every layout
 * shift the browser reports, in the page global `key`. Pass it to
 * `page.addInitScript` before the page loads, with the global's name.
 */
export function recordLayoutShifts(key: string) {
  const shifts: { time: number; value: number }[] = [];
  Object.defineProperty(window, key, { value: shifts });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if ("value" in entry && typeof entry.value === "number") {
        shifts.push({ time: entry.startTime, value: entry.value });
      }
    }
  }).observe({ buffered: true, type: "layout-shift" });
}

/**
 * Reads every layout shift the page has recorded since navigation, and whether
 * it moved something outside every visual card. A buffered observer holds
 * every recorded shift as soon as it observes, so taking its records reads
 * them at once. WebKit has no Layout Instability API, so there it reads none
 * and a suite proves stability through the placement of the page instead.
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
      // The element a source names, or the parent of the text it names.
      const elementOf = (node: unknown) => {
        if (node instanceof Element) {
          return node;
        }
        return node instanceof Node ? node.parentElement : null;
      };
      const insideCard = (node: unknown) =>
        elementOf(node)?.closest('[data-slot="visual-card"]') instanceof
        Element;
      return entries.map((entry) => {
        const sources = Array.from<{ node: unknown }>(
          Reflect.get(entry, "sources") ?? []
        );
        return {
          hadRecentInput:
            "hadRecentInput" in entry && entry.hadRecentInput === true,
          // A shift with no source to name counts as the page's.
          outside:
            sources.length === 0 ||
            sources.some((source) => !insideCard(source.node)),
          value:
            "value" in entry && typeof entry.value === "number"
              ? entry.value
              : 0,
        };
      });
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
 * Reads the cumulative layout shift of the page around its visual cards: the
 * shifts that moved something outside every card. A card that changes
 * presentation moves its own contents, and the browser answers that to the
 * press only within half a second of it, so a loaded machine that draws the
 * card later records the move as a shift nobody caused. The page behind the
 * card is the part a card must never move.
 */
export const readPageLayoutShift = Effect.fn("NakafaE2E.readPageLayoutShift")(
  function* (page: Page) {
    const shifts = yield* readLayoutShifts(page);
    return Num.sumAll(
      Arr.map(
        Arr.filter(
          shifts,
          ({ hadRecentInput, outside }) => outside && !hadRecentInput
        ),
        ({ value }) => value
      )
    );
  }
);

/**
 * Whether the topmost element at a point of the page is the element itself or
 * one inside it. It runs in the page, so pass it to `locator.evaluate` with the
 * point.
 */
export function topmostAt(
  element: Element,
  point: { readonly x: number; readonly y: number }
) {
  return element.contains(
    element.ownerDocument.elementFromPoint(point.x, point.y)
  );
}

/**
 * Waits until a reader sees the element rather than a sticky header over it:
 * the topmost element at its center is the element itself or one inside it.
 */
export const expectUncovered = Effect.fn("NakafaE2E.expectUncovered")(
  function* (locator: Locator, timeout: number) {
    yield* Effect.promise(() =>
      expect
        .poll(
          async () => {
            const bounds = await locator.boundingBox();
            if (!bounds) {
              return false;
            }
            return locator.evaluate(topmostAt, {
              x: bounds.x + bounds.width / 2,
              y: bounds.y + bounds.height / 2,
            });
          },
          { timeout }
        )
        .toBe(true)
    );
  }
);
