import { expect, type Page } from "@playwright/test";
import { Effect, Schema } from "effect";
import { FIGURE_WIDTH } from "@/components/state/size";
import {
  expectNoOverflow,
  readCumulativeLayoutShift,
} from "./layout";
import { STATE_FIGURE } from "./selector";

/** What a full-page state says and offers: its title, its sentence, and each way on with where it leads. */
const StateSchema = Schema.Struct({
  description: Schema.String,
  links: Schema.Array(
    Schema.Struct({ href: Schema.String, label: Schema.String })
  ),
  title: Schema.String,
});

/** The width of her place, in the page as it stands. */
const roomOf = (page: Page) =>
  page.locator(STATE_FIGURE).evaluate((place) => place.clientWidth);

/** The width of her place, which is the room that the things beside her have. */
const readRoom = Effect.fn("NakafaE2E.readRoom")(function* (page: Page) {
  return yield* Effect.promise(() => roomOf(page));
});

/**
 * Sets the viewport to the width at which her place is exactly `room` wide.
 * What the page keeps around her place is not the same at every width: where
 * scrollbars take room, a page narrower than 24rem keeps one scrollbar gutter
 * and a wider one keeps two (`globals.css`). So the width is reckoned from what
 * the page keeps where it stands, and again from where that lands, until her
 * place has the room.
 */
export const giveRoom = Effect.fn("NakafaE2E.giveRoom")(function* (
  page: Page,
  room: number
) {
  yield* Effect.promise(() =>
    expect(async () => {
      const has = await roomOf(page);

      if (has !== room) {
        const { height, width } = await page.evaluate(() => ({
          height: window.innerHeight,
          width: window.innerWidth,
        }));

        await page.setViewportSize({ height, width: width + room - has });
      }
      expect(await roomOf(page)).toBe(room);
    }).toPass()
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

/** The files of a web font, as the browser asks for them. */
const WEB_FONT = "**/*.woff2";

/**
 * Keeps the web font away from a page, so its text stays in the fallback font
 * from the first paint on. Call it before the page is opened.
 *
 * A font that arrives after the first paint draws the text again a little
 * wider or taller, and the browser reports that as a layout shift. Whether it
 * happens depends on which of the font and the paint comes first: on a fast
 * machine the words of the standalone page moved sideways in 6 of 8 fresh
 * visits, and on a CI runner they also moved down by a pixel, and at 200
 * pixels wide the title wrapped onto another line (measured on 13 October
 * 2026). That is the font strategy of the whole site, which swaps the font in.
 * With the font out of the way, whatever still moves is the page's own doing,
 * and a state must not move at all.
 */
export const holdWebFont = Effect.fn("NakafaE2E.holdWebFont")(function* (
  page: Page
) {
  yield* Effect.promise(() => page.route(WEB_FONT, (route) => route.abort()));
});

/**
 * A state that Nina fills with a figure: its one title, its sentence and each
 * way on shown, each way on leading where it should, the things beside her
 * shown exactly when the room holds the three, the page no wider than the
 * window, and nothing moving while it loads. Open the page after `holdWebFont`.
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
  const layoutShift = yield* readCumulativeLayoutShift(page);
  yield* Effect.sync(() => expect(layoutShift).toBe(0));
});
