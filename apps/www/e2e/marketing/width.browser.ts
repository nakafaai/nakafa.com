import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { expectNoOverflow } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { scrollThroughPage } from "@/e2e/support/scroll";
import {
  compactViewport,
  tabletPortraitViewport,
  touchViewport,
  viewportSize,
} from "@/e2e/support/viewport";

/** The widths below the desktop, where long words and long tab names push hardest on the page. */
const NARROW_VIEWPORTS = [
  compactViewport,
  touchViewport,
  tabletPortraitViewport,
];

for (const viewport of NARROW_VIEWPORTS) {
  test(`home page fits ${viewport.name} with no sideways scroll in every language`, async ({
    baseURL,
    browser,
  }) => {
    expect(baseURL).toBeTruthy();
    await Effect.runPromise(
      withBrowserContext(
        browser,
        {
          baseURL: baseURL ?? "",
          hasTouch: viewport.hasTouch,
          serviceWorkers: "block",
          viewport: viewportSize(viewport),
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.forEach(["id", "en", "de"], (locale) =>
                Effect.gen(function* () {
                  yield* openRoute(page, `/${locale}`, "denied");
                  // Every part mounts on the way down, the lesson labs and the toys included.
                  yield* scrollThroughPage(page);
                  yield* expectNoOverflow(page, locale);
                  const header = yield* Effect.promise(() =>
                    page.evaluate(() => {
                      const element = document.querySelector("header");
                      return element
                        ? element.scrollWidth - element.clientWidth
                        : 0;
                    })
                  );
                  yield* Effect.sync(() =>
                    expect(header, `${locale} header`).toBe(0)
                  );
                })
              )
            );
          })
      )
    );
  });
}
