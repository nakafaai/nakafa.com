import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";

/** Whether a part's heading is drawn, rather than skipped until the reader nears it. */
function isDrawn(page: Page, id: string) {
  return page
    .locator(`#${id} h2`)
    .first()
    .evaluate((heading) =>
      heading.checkVisibility({ contentVisibilityAuto: true })
    );
}

/** Scrolls the page to `top` and waits for two frames, as a reader's scroll draws them. */
function scrollTo(page: Page, top: number) {
  return page.evaluate(async (y) => {
    window.scrollTo(0, y);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  }, top);
}

/**
 * The landing styles, lays out and paints the screen the reader sees at first:
 * a part below it is drawn only as the reader nears it, and drawing the parts on
 * the way down moves nothing on the screen.
 */
for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test(`the landing draws its parts as the reader nears them, and nothing moves, at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* openRoute(page, "/id", "denied");
          yield* Effect.promise(async () => {
            await page.waitForLoadState("load");
            expect(await isDrawn(page, "community")).toBe(false);

            // Down the page about a screen at a time.
            const height = await page.evaluate(
              () => document.documentElement.scrollHeight
            );
            for (let top = 0; top < height; top += viewport.height * 0.8) {
              await scrollTo(page, top);
            }
            await page.locator("#community h2").scrollIntoViewIfNeeded();
            await expect.poll(() => isDrawn(page, "community")).toBe(true);
          });
          expect(yield* readCumulativeLayoutShift(page)).toBe(0);
        })
      )
    );
  });
}
