import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
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
const narrowingWidths = [1180, 1024, 820, 768, 600, 430, 390, 360, 320];

/** Lets two animation frames pass, so a layout change that the browser reports in a frame has landed. */
const twoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

/**
 * Reads whether the document is wider than the window, and names the outermost
 * elements that reach past the window's right edge. It then scrolls sideways
 * as far as the page allows, so a page that is wider than the window shows a
 * scroll position other than 0.
 */
const readSideways = (page: Page) =>
  page.evaluate(() => {
    const edge = window.innerWidth + 0.5;
    const wide = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
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
    window.scrollTo(100_000, window.scrollY);
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollX: window.scrollX,
      wide,
    };
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
  const sideways = yield* Effect.promise(() => readSideways(page));
  const message = `${route} at ${width}px: ${Arr.join(sideways.wide, "; ")}`;
  yield* Effect.sync(() => {
    expect(sideways.scrollWidth, message).toBeLessThanOrEqual(
      sideways.clientWidth
    );
    expect(sideways.scrollX, message).toBe(0);
  });
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
