import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { targetViewports, viewportSize } from "@/e2e/support/viewport";

/** Nina, the line under the header and the header's links, measured as the eye sees them. */
function readHeader() {
  const header = document.querySelector("header");
  const nina = document.querySelector('[data-slot="header-nina"]');
  if (header === null || nina === null) {
    return null;
  }
  const bar = header.getBoundingClientRect();
  const figure = nina.getBoundingClientRect();
  const links = Array.from(header.querySelectorAll("nav a"), (link) =>
    link.getBoundingClientRect()
  ).filter((rect) => rect.width > 0);
  return {
    border: getComputedStyle(header).borderBottomWidth,
    linkGaps: links
      .slice(1)
      .map((rect, index) => rect.left - links[index].right),
    lineTop: bar.bottom - 1,
    ninaBottom: figure.bottom,
    ninaCentre: figure.left + figure.width / 2,
    pageCentre: document.documentElement.clientWidth / 2,
    top: bar.top,
  };
}

/**
 * Checks the header as the identity's Header card draws it: the line under it
 * is drawn, Nina stands in the middle of the page with her feet on that line,
 * and the links sit side by side with no space beyond their own padding.
 */
const expectHeaderDrawn = Effect.fn("NakafaE2E.expectHeaderDrawn")(function* (
  page: Page
) {
  const drawn = yield* Effect.promise(() => page.evaluate(readHeader));
  yield* Effect.sync(() => {
    expect(drawn).not.toBeNull();
    if (drawn === null) {
      return;
    }
    expect(drawn.top).toBe(0);
    expect(drawn.border).toBe("1px");
    expect(Math.abs(drawn.ninaCentre - drawn.pageCentre)).toBeLessThanOrEqual(
      1
    );
    expect(Math.abs(drawn.ninaBottom - drawn.lineTop)).toBeLessThanOrEqual(1);
    for (const gap of drawn.linkGaps) {
      expect(gap).toBeLessThanOrEqual(2);
    }
  });
});

for (const viewport of targetViewports) {
  test(`the marketing header keeps Nina centred on its line through history and fast scrolling at ${viewport.name}`, async ({
    baseURL,
    browser,
  }) => {
    await Effect.runPromise(
      withBrowserContext(
        browser,
        {
          ...(baseURL === undefined ? {} : { baseURL }),
          hasTouch: viewport.hasTouch,
          viewport: viewportSize(viewport),
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                const heading = page.getByRole("heading", { level: 1 });
                yield* openRoute(page, "/en", "denied");
                yield* Effect.promise(() => expect(heading).toBeVisible());
                const home = yield* Effect.promise(() => heading.textContent());
                yield* expectHeaderDrawn(page);

                // Fast wheel bursts down the page and back up.
                yield* Effect.promise(async () => {
                  for (const delta of Arr.makeBy(12, () => 1600)) {
                    await page.mouse.wheel(0, delta);
                  }
                  await page.waitForTimeout(400);
                  for (const delta of Arr.makeBy(12, () => -1600)) {
                    await page.mouse.wheel(0, delta);
                  }
                  await page.waitForTimeout(400);
                });
                yield* expectHeaderDrawn(page);

                // Pricing and back, then forward again, through the browser's history.
                yield* Effect.promise(() => page.goto("/en/pricing"));
                yield* Effect.promise(() =>
                  expect(heading).not.toHaveText(home ?? "")
                );
                yield* expectHeaderDrawn(page);
                yield* Effect.promise(() => page.goBack());
                yield* Effect.promise(() =>
                  expect(heading).toHaveText(home ?? "")
                );
                yield* expectHeaderDrawn(page);
                yield* Effect.promise(() => page.goForward());
                yield* Effect.promise(() =>
                  expect(heading).not.toHaveText(home ?? "")
                );
                yield* expectHeaderDrawn(page);
              })
            );
          })
      )
    );
  });
}
