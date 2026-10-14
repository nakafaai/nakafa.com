import { expect, type Page, test } from "@playwright/test";
import { Effect, MutableList, Schema } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { NEXT_CHUNK_PATH, openRoute } from "@/e2e/support/route";
import {
  readinessTimeoutMilliseconds,
  revealTimeoutMilliseconds,
} from "@/e2e/support/timeout";
import {
  desktopViewport,
  tabletPortraitViewport,
  touchViewport,
} from "@/e2e/support/viewport";

/** The parts of the home page, in the order of the page. */
const HOME_PARTS = [
  "hero",
  "lesson",
  "tryout",
  "nina",
  "scene",
  "memory",
  "privacy",
  "curricula",
  "letter",
  "medals",
  "pricing",
  "school",
  "faq",
  "community",
  "closing",
];

/** The widths the home page must hold at: a phone with touch, a tablet and a desktop. */
const HOME_VIEWPORTS = [touchViewport, tabletPortraitViewport, desktopViewport];

/** The two colour schemes the home page must hold in. */
const COLOR_SCHEMES = Schema.Literals(["light", "dark"]).literals;

/**
 * Long enough for a lesson to stay open for its full turn after it reaches the
 * screen, with room for the observer to see it. A lesson opens its next one
 * after six seconds.
 */
const LESSON_TURN_MS = 8000;

/** The name of the retry button that the projectile scene offers after a failed load. */
const RETRY_NAME = "Retry";

/** The width and height of a viewport, as a browser context takes them. */
function viewportSize(viewport: {
  readonly height: number;
  readonly width: number;
}) {
  return { height: viewport.height, width: viewport.width };
}

/**
 * Scrolls the whole page one screen at a time, so every part reaches the
 * viewport and every observer runs, then returns to the top.
 */
const scrollThroughPage = Effect.fn("NakafaE2E.scrollThroughPage")(function* (
  page: Page
) {
  const height = yield* Effect.promise(() =>
    page.evaluate(() => window.innerHeight)
  );
  const documentHeight = yield* Effect.promise(() =>
    page.evaluate(() => document.documentElement.scrollHeight)
  );
  for (
    let offset = 0;
    offset < documentHeight;
    offset += Math.round(height * 0.8)
  ) {
    yield* Effect.promise(() =>
      page.evaluate((top) => window.scrollTo(0, top), offset)
    );
    yield* Effect.promise(() => page.waitForTimeout(120));
  }
  yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 0)));
});

/** Collects the console errors and warnings a page writes, hydration warnings included. */
function observeConsole(page: Page) {
  const issues = MutableList.make<string>();
  page.on("console", (message) => {
    const type = message.type();
    if (type === "error" || type === "warning") {
      MutableList.append(issues, `${type}: ${message.text()}`);
    }
  });
  return issues;
}

for (const viewport of HOME_VIEWPORTS) {
  for (const colorScheme of COLOR_SCHEMES) {
    test(`home page keeps still and quiet at ${viewport.name} in ${colorScheme}`, async ({
      baseURL,
      browser,
    }) => {
      expect(baseURL).toBeTruthy();
      await Effect.runPromise(
        withBrowserContext(
          browser,
          {
            baseURL: baseURL ?? "",
            colorScheme,
            hasTouch: viewport.hasTouch,
            reducedMotion: "no-preference",
            serviceWorkers: "block",
            viewport: viewportSize(viewport),
          },
          (context) =>
            Effect.gen(function* () {
              const page = yield* Effect.promise(() => context.newPage());
              const issues = observeConsole(page);
              yield* withObservedPageErrors(
                page,
                Effect.gen(function* () {
                  yield* openRoute(page, "/id", "denied");
                  yield* Effect.promise(() =>
                    page.waitForLoadState("networkidle")
                  );
                  yield* scrollThroughPage(page);
                  const shift = yield* readCumulativeLayoutShift(page);
                  expect(shift).toBe(0);
                  expect(MutableList.toArray(issues)).toEqual([]);
                })
              );
            })
        )
      );
    });
  }
}

test("home page carries every part in Indonesian, English and German", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.forEach(["id", "en", "de"], (locale) =>
              Effect.gen(function* () {
                yield* openRoute(page, `/${locale}`, "denied");
                yield* Effect.promise(() =>
                  expect(page.locator("h1")).toBeVisible()
                );
                yield* Effect.forEach(HOME_PARTS, (part) =>
                  Effect.promise(() =>
                    expect(page.locator(`#${part}`)).toBeAttached()
                  )
                );
              })
            )
          );
        })
    )
  );
});

test("home page holds still with reduced motion", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() => page.waitForTimeout(LESSON_TURN_MS));
              const selected = page
                .locator("#lesson")
                .getByRole("tab", { selected: true });
              yield* Effect.promise(() =>
                expect(selected).toHaveText("Gerak parabola")
              );
            })
          );
        })
    )
  );
});

test("home page opens the next lesson by itself while the lessons are on screen", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "no-preference",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              yield* Effect.promise(() =>
                page.locator("#lesson").scrollIntoViewIfNeeded()
              );
              yield* Effect.promise(() => page.waitForTimeout(LESSON_TURN_MS));
              const selected = page
                .locator("#lesson")
                .getByRole("tab", { selected: true });
              yield* Effect.promise(() =>
                expect(selected).toHaveText("Fungsi kuadrat")
              );
            })
          );
        })
    )
  );
});

test("home page defers the projectile scene until the reader scrolls to it", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: viewportSize(desktopViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/id", "denied");
              const scene = page.locator("#scene");

              yield* Effect.promise(() => expect(scene).toHaveCount(1));
              yield* Effect.promise(() =>
                expect(scene.locator("canvas")).toHaveCount(0)
              );
              yield* Effect.promise(() =>
                expect(scene.getByRole("status")).toHaveCount(0)
              );

              yield* Effect.promise(() => scene.scrollIntoViewIfNeeded());
              yield* Effect.promise(() =>
                expect(scene.locator("canvas")).toBeAttached({
                  timeout: revealTimeoutMilliseconds,
                })
              );
            })
          );
        })
    )
  );
});

test("home page recovers the projectile scene after a failed load", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: viewportSize(tabletPortraitViewport),
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* openRoute(page, "/en", "denied");
              const scene = page.locator("#scene");
              const error = scene.getByRole("alert");
              const retry = error.getByRole("button", { name: RETRY_NAME });

              yield* Effect.promise(() =>
                page.route(NEXT_CHUNK_PATH, (route) => route.abort("failed"))
              );
              yield* Effect.promise(() => scene.scrollIntoViewIfNeeded());
              yield* Effect.promise(() =>
                expect(error).toBeVisible({
                  timeout: readinessTimeoutMilliseconds,
                })
              );
              yield* Effect.promise(() => expect(retry).toBeVisible());

              yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
              yield* Effect.promise(() =>
                Promise.all([
                  page.waitForEvent("framenavigated", {
                    predicate: (frame) => frame === page.mainFrame(),
                  }),
                  retry.click(),
                ])
              );
              yield* Effect.promise(() =>
                page.waitForLoadState("domcontentloaded")
              );
              yield* Effect.promise(() =>
                expect
                  .poll(() =>
                    page.evaluate(() => {
                      const [entry] =
                        performance.getEntriesByType("navigation");
                      return entry instanceof PerformanceNavigationTiming
                        ? entry.type
                        : null;
                    })
                  )
                  .toBe("reload")
              );

              yield* Effect.promise(() => scene.scrollIntoViewIfNeeded());
              yield* Effect.promise(() =>
                expect(scene.locator("canvas")).toBeAttached({
                  timeout: revealTimeoutMilliseconds,
                })
              );
            })
          );
        })
    )
  );
});
