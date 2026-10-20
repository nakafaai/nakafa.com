import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { CHAT_PATH } from "../support/chat";
import { seedAnalyticsConsent } from "../support/consent";
import { withObservedPageErrors } from "../support/observe";
import { revealTimeoutMilliseconds } from "../support/timeout";

/** What the app's weather route answers for a long place name in heavy rain, at -10 degrees. */
const SUMMARY = {
  city: "Kabupaten Tanjung Jabung Barat",
  condition: "heavy intensity shower rain",
  country: "ID",
  countryName: "Indonesia",
  icon: "09d",
  temperatureKelvin: 263.15,
};

/** Opens the new chat page with the weather route answering `answer`. */
const openHome = Effect.fn("NakafaE2E.openHome")(function* (
  page: Page,
  answer: Parameters<Page["route"]>[1]
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(async () => {
    await page.route("**/api/weather", answer);
    await page.goto(CHAT_PATH);
  });
  // The grid under the composer holds the videos card and the weather cell.
  return page.locator('a[href*="youtube"]').locator("..");
});

/**
 * What the weather card shows, read in the page: where its box ends, and for
 * each line of text how many lines it takes, where it ends, and whether it
 * runs out of its box sideways.
 */
const readCard = (grid: HTMLElement) => {
  const card = grid.children[1];
  if (!card) {
    return null;
  }
  const box = card.getBoundingClientRect();
  const style = getComputedStyle(card);
  const inner = box.bottom - Number.parseFloat(style.paddingBottom);
  return {
    paragraphs: Array.from(card.querySelectorAll("p"), (paragraph) => {
      const rect = paragraph.getBoundingClientRect();
      const lineHeight = Number.parseFloat(
        getComputedStyle(paragraph).lineHeight
      );
      return {
        insideBox: rect.bottom <= inner + 0.5,
        lines: Math.round(rect.height / lineHeight),
        sideways: paragraph.scrollWidth > paragraph.clientWidth + 1,
        text: paragraph.textContent,
      };
    }),
  };
};

/** The cells of the grid and whether the second one shows anything, read in the page. */
const readCells = (grid: HTMLElement) => {
  const cells = Array.from(grid.children, (cell) => {
    const box = cell.getBoundingClientRect();
    const style = getComputedStyle(cell);
    return {
      border: Number.parseFloat(style.borderTopWidth),
      fill: style.backgroundImage,
      height: box.height,
      text: cell.textContent,
      width: box.width,
    };
  });
  return cells;
};

for (const width of [320, 1440]) {
  test.describe(`Weather on the new chat page at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("holds a long place, a long condition and a negative temperature", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            const grid = yield* openHome(page, (route) =>
              route.fulfill({ json: SUMMARY })
            );
            yield* Effect.promise(() =>
              expect(grid.getByText("° C")).toBeVisible()
            );
            const card = yield* Effect.promise(() => grid.evaluate(readCard));

            yield* Effect.sync(() => {
              expect(card?.paragraphs).toHaveLength(3);
              const [temperature, condition, place] = card?.paragraphs ?? [];
              // The temperature is never broken, and nothing leaves the box.
              expect(temperature).toMatchObject({
                insideBox: true,
                lines: 1,
                sideways: false,
                text: "-10° C",
              });
              expect(condition?.insideBox).toBe(true);
              expect(condition?.lines).toBeLessThanOrEqual(2);
              expect(place?.insideBox).toBe(true);
              expect(place?.lines).toBeLessThanOrEqual(2);
            });
            yield* Effect.promise(() =>
              expect(
                grid.getByTitle("Kabupaten Tanjung Jabung Barat, Indonesia")
              ).toBeVisible()
            );
          })
        )
      );
    });

    test("keeps the grid in shape when the weather cannot be read", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            const grid = yield* openHome(page, (route) =>
              route.fulfill({ status: 500 })
            );
            // The skeleton shows while the request tries, and goes once it has
            // given up. The request tries again after one, two and four seconds
            // (lib/weather/request.ts) and this route answers at once, so the
            // wait is those seven seconds. The suite's time for a deferred card
            // to reveal itself holds them.
            const skeleton = grid.locator('[data-slot="skeleton"]');
            yield* Effect.promise(async () => {
              await expect(skeleton.first()).toBeVisible();
              await expect(skeleton).toHaveCount(0, {
                timeout: revealTimeoutMilliseconds,
              });
            });
            const cells = yield* Effect.promise(() => grid.evaluate(readCells));

            yield* Effect.sync(() => {
              expect(cells).toHaveLength(2);
              const [videos, weather] = cells;
              // The empty cell has the box of its neighbor and shows nothing.
              expect(weather?.width).toBeCloseTo(videos?.width ?? 0, 0);
              expect(weather?.height).toBeCloseTo(videos?.height ?? 0, 0);
              expect(weather).toMatchObject({
                border: 0,
                fill: "none",
                text: "",
              });
            });
          })
        )
      );
    });
  });
}
