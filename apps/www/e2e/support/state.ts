import { expect, type Page } from "@playwright/test";
import { Effect, Schema } from "effect";
import { FIGURE_WIDTH } from "@/components/state/size";
import { STATE_FIGURE } from "@/e2e/support/selector";

/** What a full-page state says and offers: its title, its sentence, and each way on with where it leads. */
const StateSchema = Schema.Struct({
  description: Schema.String,
  links: Schema.Array(
    Schema.Struct({ href: Schema.String, label: Schema.String })
  ),
  title: Schema.String,
});

/** The width of her place, which is the room that the things beside her have. */
export const readRoom = Effect.fn("NakafaE2E.readRoom")(function* (page: Page) {
  return yield* Effect.promise(() =>
    page.locator(STATE_FIGURE).evaluate((place) => place.clientWidth)
  );
});

/**
 * The pictures in her place stand in the order a thing, Nina, a thing, and the
 * things are left out only when the room is narrower than the three side by
 * side. Left out, they are still in the page.
 */
export const expectThings = Effect.fn("NakafaE2E.expectThings")(function* (
  page: Page,
  shown: boolean
) {
  const pictures = page.locator(STATE_FIGURE).locator("svg");
  yield* Effect.promise(() => expect(pictures).toHaveCount(3));
  yield* Effect.forEach(
    [pictures.first(), pictures.last()],
    (thing) =>
      Effect.promise(() =>
        shown ? expect(thing).toBeVisible() : expect(thing).toBeHidden()
      ),
    { discard: true }
  );
});

/** The page is no wider than the window, whatever the state holds and whatever the window is. */
export const expectNoOverflow = Effect.fn("NakafaE2E.expectNoOverflow")(
  function* (page: Page) {
    const overflow = yield* Effect.promise(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    );
    yield* Effect.sync(() => expect(overflow).toBeLessThanOrEqual(0));
  }
);

/**
 * How far anything on the page moved up or down since navigation, or grew or
 * shrank in height, in pixels: the most of every layout shift the browser
 * reports.
 *
 * It leaves the sideways part out on purpose. The title and the sentence stand
 * in the middle, and a web font that arrives after the first paint makes a
 * line a few pixels wider or narrower, which moves its start sideways. The
 * browser reports that as a shift too, and whether it happens depends on which
 * of the font and the first paint comes first (measured on 13 October 2026:
 * 6 of 8 fresh visits of the standalone page, each 0.0002 or less). What a
 * state promises is that nothing already shown moves down when Nina arrives,
 * and this reads exactly that.
 */
const readVerticalShift = Effect.fn("NakafaE2E.readVerticalShift")(function* (
  page: Page
) {
  return yield* Effect.promise(() =>
    page.evaluate(() => {
      const observer = new PerformanceObserver(() => undefined);
      observer.observe({ buffered: true, type: "layout-shift" });
      const entries = observer.takeRecords();
      observer.disconnect();
      return entries
        .flatMap((entry) =>
          Array.from<{
            currentRect: DOMRectReadOnly;
            previousRect: DOMRectReadOnly;
          }>(Reflect.get(entry, "sources") ?? [])
        )
        .reduce(
          (most, { currentRect, previousRect }) =>
            Math.max(
              most,
              Math.abs(currentRect.y - previousRect.y),
              Math.abs(currentRect.height - previousRect.height)
            ),
          0
        );
    })
  );
});

/**
 * A state that Nina fills with a figure: its one title, its sentence and each
 * way on shown, each way on leading where it should, the things beside her
 * shown exactly when the room holds the three, the page no wider than the
 * window, and nothing moving up or down while it loads.
 */
export const expectState = Effect.fn("NakafaE2E.expectState")(function* (
  page: Page,
  state: typeof StateSchema.Type
) {
  yield* Effect.promise(() =>
    expect(
      page.getByRole("heading", { level: 1, name: state.title })
    ).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(page.getByText(state.description)).toBeVisible()
  );
  yield* Effect.forEach(
    state.links,
    ({ href, label }) => {
      const link = page.getByRole("link", { exact: true, name: label });
      return Effect.promise(() => expect(link).toBeVisible()).pipe(
        Effect.andThen(
          Effect.promise(() => expect(link).toHaveAttribute("href", href))
        )
      );
    },
    { discard: true }
  );

  const room = yield* readRoom(page);
  yield* expectThings(page, room >= FIGURE_WIDTH);
  yield* expectNoOverflow(page);
  yield* Effect.promise(() => page.waitForLoadState("load"));
  const moved = yield* readVerticalShift(page);
  yield* Effect.sync(() => expect(moved).toBe(0));
});
