import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { NEXT_CHUNK_PATH, openRoute } from "@/e2e/support/route";
import {
  readinessTimeoutMilliseconds,
  revealTimeoutMilliseconds,
} from "@/e2e/support/timeout";
import {
  desktopViewport,
  tabletPortraitViewport,
  viewportSize,
} from "@/e2e/support/viewport";

/** The name of the retry button that the projectile scene offers after a failed load. */
const RETRY_NAME = "Retry";

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
              // The fullscreen control keeps an empty live region, so only the named loading status counts.
              yield* Effect.promise(() =>
                expect(scene.getByRole("status", { name: /\S/ })).toHaveCount(0)
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

              // The page's own chunks load while it hydrates, so the failure starts once they are in.
              yield* Effect.promise(() => page.waitForLoadState("networkidle"));
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
