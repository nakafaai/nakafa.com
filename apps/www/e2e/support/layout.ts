import { expect, type Locator, type Page } from "@playwright/test";
import { Array as Arr, Effect, Number as Num, Schema } from "effect";
import { VISUAL_CARD } from "@/e2e/support/selector";

/**
 * Records, from the first script on, the start time, value and input of every
 * layout shift the browser reports, in the page global `key`, with one line per
 * element that moved: what it is, where it was, and where it went. A shift is
 * left out when everything that moved sits inside a fixed element that matches
 * `overlay`, such as the list that holds the toasts: a toast stacks over the
 * page and animates its own height, which is not the page moving. An element
 * that stays in the flow of the page is the page, so its shifts count.
 * Pass it to `page.addInitScript` before the page loads, with the global's name
 * and the selector. `readRecordedLayoutShifts` reads what it holds.
 */
export function recordLayoutShifts({
  key,
  overlay,
}: {
  key: string;
  overlay: string;
}) {
  const shifts: {
    hadRecentInput: boolean;
    sources: string[];
    time: number;
    value: number;
  }[] = [];
  Object.defineProperty(window, key, { value: shifts });
  const box = (rect: unknown) =>
    rect instanceof DOMRectReadOnly
      ? `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}`
      : "unknown";
  // The element a source names, or the parent of the text it names.
  const name = (node: unknown) => {
    const element = node instanceof Element ? node : null;
    const owner = element ?? (node instanceof Node ? node.parentElement : null);
    if (!owner) {
      return "detached node";
    }
    const slot = owner.getAttribute("data-slot");
    const classes = owner.getAttribute("class") ?? "";
    return `${owner.tagName.toLowerCase()}${slot ? `[data-slot=${slot}]` : ""} class="${classes.slice(0, 80)}"${element ? "" : " (text)"}`;
  };
  // Whether the node sits inside a fixed element that matches `overlay`.
  const insideOverlay = (node: unknown) => {
    const owner = node instanceof Node ? node : null;
    const element = owner instanceof Element ? owner : owner?.parentElement;
    const container = element?.closest(overlay);
    return (
      container instanceof Element &&
      getComputedStyle(container).position === "fixed"
    );
  };
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if ("value" in entry && typeof entry.value === "number") {
        const sources = Array.from<{
          currentRect: unknown;
          node: unknown;
          previousRect: unknown;
        }>(Reflect.get(entry, "sources") ?? []);
        // A shift with no source to name counts as the page's.
        const movedOnlyTheOverlay =
          sources.length > 0 &&
          sources.every((source) => insideOverlay(source.node));
        if (!movedOnlyTheOverlay) {
          shifts.push({
            hadRecentInput:
              "hadRecentInput" in entry && entry.hadRecentInput === true,
            sources: sources.map(
              (source) =>
                `${name(source.node)}: ${box(source.previousRect)} to ${box(source.currentRect)}`
            ),
            time: entry.startTime,
            value: entry.value,
          });
        }
      }
    }
  }).observe({ buffered: true, type: "layout-shift" });
}

/** One layout shift the recorder kept: whether input caused it, and what it moved. */
const RecordedLayoutShift = Schema.Struct({
  hadRecentInput: Schema.Boolean,
  sources: Schema.Array(Schema.String),
  time: Schema.Finite,
  value: Schema.Finite,
});

/**
 * Reads the shifts that `recordLayoutShifts` kept under `key`. The read fails
 * when the recorder did not start on the page, so a missing record never reads
 * as a still page.
 */
export const readRecordedLayoutShifts = Effect.fn(
  "NakafaE2E.readRecordedLayoutShifts"
)(function* (page: Page, key: string) {
  return yield* Effect.promise(() =>
    page.evaluate((name) => Reflect.get(window, name), key)
  ).pipe(
    Effect.flatMap(
      Schema.decodeUnknownEffect(Schema.Array(RecordedLayoutShift))
    )
  );
});

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
    page.evaluate((visualCard) => {
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
        elementOf(node)?.closest(visualCard) instanceof Element;
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
    }, VISUAL_CARD)
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
 * Asserts that the page is no wider than the window. A failure names the
 * outermost elements that reach past the window's right edge, after `label`,
 * so the route and width that failed say which parts overflow.
 */
export const expectNoOverflow = Effect.fn("NakafaE2E.expectNoOverflow")(
  function* (page: Page, label = "page") {
    const sideways = yield* Effect.promise(() =>
      page.evaluate(() => {
        const edge = window.innerWidth + 0.5;
        const wide = Array.from(
          document.body.querySelectorAll<HTMLElement>("*")
        )
          .filter(
            (element) =>
              element.getBoundingClientRect().right > edge &&
              !(
                element.parentElement &&
                element.parentElement.getBoundingClientRect().right > edge
              )
          )
          .slice(0, 5)
          .map(
            (element) =>
              `${element.tagName.toLowerCase()}.${element.getAttribute("class") ?? ""}`
          );
        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          wide,
        };
      })
    );
    yield* Effect.sync(() =>
      expect(
        sideways.scrollWidth,
        `${label}: ${Arr.join(sideways.wide, "; ")}`
      ).toBeLessThanOrEqual(sideways.clientWidth)
    );
  }
);

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

/**
 * Waits until a sheet or dialog has finished sliding in. A popup's geometry
 * read while it still moves is off by a fraction of a pixel, and a jump made
 * during the slide can still shift on a slow runner.
 */
export const waitForSlide = Effect.fn("NakafaE2E.waitForSlide")(
  (popup: Locator) =>
    Effect.promise(() =>
      popup.evaluate(
        (element) =>
          new Promise<void>((resolve) => {
            const settle = () => {
              if (element.hasAttribute("data-starting-style")) {
                requestAnimationFrame(settle);
                return;
              }
              Promise.allSettled(
                element
                  .getAnimations({ subtree: true })
                  .map((animation) => animation.finished)
              ).then(() => resolve());
            };
            settle();
          })
      )
    )
);
