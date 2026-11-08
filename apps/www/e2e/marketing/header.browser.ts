import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import {
  desktopViewport,
  targetViewports,
  touchViewport,
  viewportSize,
} from "@/e2e/support/viewport";

/** The School pricing page, which the School section of the header opens. */
const SCHOOL_PRICING = /\/en\/school\/pricing$/u;

/** The report cards section of the School landing, which the phone's drawer opens. */
const SCHOOL_REPORTS = /\/en\/school#reports$/u;

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

test.describe("the header's sections at desktop", () => {
  test.use({
    viewport: { height: desktopViewport.height, width: desktopViewport.width },
  });

  test("open on hover, move between the products without closing, and close on Escape", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* loadMarketingPage(page, "/en");
          const header = page.locator("header");
          const popup = page.locator('[data-slot="navigation-menu-popup"]');
          yield* Effect.promise(() =>
            header.getByRole("button", { name: "School" }).hover()
          );
          yield* Effect.promise(() =>
            expect(popup.getByRole("link", { name: "Forum" })).toBeVisible()
          );
          yield* Effect.promise(() =>
            header.getByRole("button", { name: "Learn" }).hover()
          );
          yield* Effect.promise(() =>
            expect(popup.getByRole("link", { name: "Subjects" })).toBeVisible()
          );
          yield* Effect.promise(() => expect(popup).toHaveCount(1));
          yield* Effect.promise(() => page.keyboard.press("Escape"));
          yield* Effect.promise(() => expect(popup).toHaveCount(0));
        })
      )
    );
  });

  test("open on press and lead to a School page from the main landing", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* loadMarketingPage(page, "/en");
          yield* Effect.promise(() =>
            page
              .locator("header")
              .getByRole("button", { name: "School" })
              .click()
          );
          const popup = page.locator('[data-slot="navigation-menu-popup"]');
          yield* Effect.promise(() =>
            popup.getByRole("link", { name: "Pricing" }).click()
          );
          yield* Effect.promise(() => expect(page).toHaveURL(SCHOOL_PRICING));
          yield* Effect.promise(() => expect(popup).toHaveCount(0));
        })
      )
    );
  });
});

test.describe("the header's sections on a phone", () => {
  test.use({
    hasTouch: true,
    viewport: { height: touchViewport.height, width: touchViewport.width },
  });

  test("open in the Menu drawer, which a tap outside and a link press close", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* loadMarketingPage(page, "/en/school");
          yield* Effect.promise(() =>
            page.locator("header").getByRole("button", { name: "Menu" }).click()
          );
          const drawer = page.getByRole("dialog", { name: "Menu" });
          yield* Effect.promise(() =>
            expect(drawer.getByRole("link", { name: "Subjects" })).toBeVisible()
          );
          // The drawer draws no close button: a tap outside closes it.
          yield* Effect.promise(() =>
            expect(drawer.getByRole("button", { name: "Close" })).toHaveCount(0)
          );
          yield* Effect.promise(() => page.mouse.click(8, 8));
          yield* Effect.promise(() => expect(drawer).toHaveCount(0));
          yield* Effect.promise(() =>
            page.locator("header").getByRole("button", { name: "Menu" }).click()
          );
          yield* Effect.promise(() =>
            drawer.getByRole("link", { name: "Report cards" }).click()
          );
          yield* Effect.promise(() => expect(page).toHaveURL(SCHOOL_REPORTS));
          yield* Effect.promise(() => expect(drawer).toHaveCount(0));
        })
      )
    );
  });
});
