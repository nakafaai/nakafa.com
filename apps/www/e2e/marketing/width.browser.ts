import { expect, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
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
                  const overflow = yield* Effect.promise(() =>
                    page.evaluate(() => {
                      const header = document.querySelector("header");
                      // The outermost elements that reach past the right edge, named for the failure.
                      const wide = Array.from(
                        document.body.querySelectorAll<HTMLElement>("*")
                      )
                        .filter(
                          (element) =>
                            element.getBoundingClientRect().right >
                              window.innerWidth + 0.5 &&
                            !(
                              element.parentElement &&
                              element.parentElement.getBoundingClientRect()
                                .right >
                                window.innerWidth + 0.5
                            )
                        )
                        .slice(0, 5)
                        .map(
                          (element) =>
                            `${element.tagName.toLowerCase()}.${element.className}`
                        );
                      return {
                        header: header
                          ? header.scrollWidth - header.clientWidth
                          : 0,
                        page:
                          document.documentElement.scrollWidth -
                          window.innerWidth,
                        wide,
                      };
                    })
                  );
                  expect(
                    { header: overflow.header, page: overflow.page },
                    `${locale}: ${Arr.join(overflow.wide, "; ")}`
                  ).toEqual({ header: 0, page: 0 });
                })
              )
            );
          })
      )
    );
  });
}
