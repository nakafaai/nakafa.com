import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";

/** The most a marketing part may ask of the window, in pixels: 57.5rem, the window of a large desktop. */
const SCREEN_CAP = 920;

/**
 * A crawler's window: as wide as a phone or a desktop, and as tall as a long page, as Google renders a page to
 * index it (AdSense, 13 Nov 2026: the home's parts grew with that window without end).
 */
const CRAWLER_WINDOWS = [
  { height: 12_000, width: 412 },
  { height: 12_000, width: 1280 },
] as const;

/** The marketing pages whose parts are sized by the window. */
const PAGES = ["/en", "/en/school", "/en/pricing"] as const;

/**
 * The largest height any part of the page takes from the window: the least height of every part and hero, and the
 * stand-in height of every part the browser has not drawn yet. Each resolves to pixels in the computed style.
 */
const readLargestScreen = (page: Page) =>
  Effect.promise(() =>
    page.evaluate(() => {
      // A computed height such as `auto 920px` names its length last; `none` and `auto` alone name none.
      const pixels = (value: string) =>
        Math.max(
          0,
          ...Array.from(
            value.matchAll(/(?<length>\d+(?:\.\d+)?)px/gu),
            (match) => Number(match.groups?.length)
          )
        );
      return Math.max(
        ...Array.from(document.querySelectorAll("main *"), (element) => {
          const style = getComputedStyle(element);
          return Math.max(
            pixels(style.minHeight),
            pixels(style.containIntrinsicBlockSize)
          );
        })
      );
    })
  );

for (const window of CRAWLER_WINDOWS) {
  test(`a marketing page holds each part to one bounded screen in a ${window.width} by ${window.height} window`, async ({
    page,
  }) => {
    await page.setViewportSize(window);
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.forEach(PAGES, (href) =>
          Effect.gen(function* () {
            yield* loadMarketingPage(page, href);
            expect(yield* readLargestScreen(page), href).toBeLessThanOrEqual(
              SCREEN_CAP
            );
          })
        )
      )
    );
  });
}
