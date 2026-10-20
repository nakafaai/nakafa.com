import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { expectNoOverflow } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes, openRoute } from "@/e2e/support/route";
import { scrollThroughPage } from "@/e2e/support/scroll";
import { desktopViewport, viewportSize } from "@/e2e/support/viewport";

/**
 * The pages that must never scroll sideways: the home page in each language,
 * the marketing and legal pages, and the content pages with a canvas, a table,
 * or a long word.
 */
const routes = [
  "/id",
  "/en",
  "/de",
  "/id/pricing",
  "/id/privacy-policy",
  "/id/developers",
  "/id/contributor",
  "/id/try-out",
  appRoutes.quranSurahId,
  LESSON_PATH,
];

/** The widths the window narrows through, one after another, from the desktop to a compact phone. */
const narrowingWidths = [
  desktopViewport.width,
  1180,
  1024,
  820,
  768,
  600,
  430,
  390,
  360,
  320,
];

/** Lets two animation frames pass, so a layout change that the browser reports in a frame has landed. */
const twoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

/**
 * Scrolls the window sideways as far as the page allows, and reads where it
 * stopped. A page that is wider than the window scrolls, so it stops at a
 * position other than 0. This runs after the width check, because scrolling
 * moves every element that the check measures.
 */
const scrollSideways = (page: Page) =>
  page.evaluate(() => {
    window.scrollTo(100_000, window.scrollY);
    return window.scrollX;
  });

/**
 * Narrows the window to `width`, lets the layout settle, and checks that the
 * page fits the window and does not scroll sideways.
 */
const narrowTo = Effect.fn("NakafaE2E.narrowToWidth")(function* (
  page: Page,
  route: string,
  width: number
) {
  yield* Effect.promise(() =>
    page.setViewportSize({ height: desktopViewport.height, width })
  );
  yield* Effect.promise(() => twoFrames(page));
  const label = `${route} at ${width}px`;
  yield* expectNoOverflow(page, label);
  const scrollX = yield* Effect.promise(() => scrollSideways(page));
  yield* Effect.sync(() => expect(scrollX, label).toBe(0));
});

for (const route of routes) {
  test(`${route} never scrolls sideways from 1440 px down to 320 px`, async ({
    baseURL,
    browser,
  }) => {
    expect(baseURL).toBeTruthy();
    await Effect.runPromise(
      withBrowserContext(
        browser,
        {
          baseURL: baseURL ?? "",
          hasTouch: desktopViewport.hasTouch,
          serviceWorkers: "block",
          viewport: viewportSize(desktopViewport),
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                yield* openRoute(page, route, "denied");
                // Every part mounts on the way down, and the page ends at the top.
                yield* scrollThroughPage(page);
                yield* Effect.forEach(
                  narrowingWidths,
                  (width) => narrowTo(page, route, width),
                  { discard: true }
                );
              })
            );
          })
      )
    );
  });
}
