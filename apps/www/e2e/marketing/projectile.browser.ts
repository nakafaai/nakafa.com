import { expect, test } from "@playwright/test";
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import { Effect, MutableList } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  abortChunkHolding,
  NEXT_CHUNK_PATH,
  openRoute,
} from "@/e2e/support/route";
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

/** Matches an accessible name with text, so an empty live region does not count. */
const NAMED_STATUS = /\S/;

/**
 * Text that only the particle field's code holds: the field paints its dots in
 * these two colours. The field loads while the hero hydrates.
 */
const PARTICLES_MARKER = "oklch(0.985 0 0 / ";

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
              // The scene is a named landmark inside its section, so landmark
              // navigation finds it.
              yield* Effect.promise(() =>
                expect(
                  scene.getByRole("region", {
                    exact: true,
                    name: id.Landing["scene-label"],
                  })
                ).toHaveCount(1)
              );
              yield* Effect.promise(() =>
                expect(scene.locator("canvas")).toHaveCount(0)
              );
              // The fullscreen control keeps an empty live region, so only the named loading status counts.
              yield* Effect.promise(() =>
                expect(
                  scene.getByRole("status", { name: NAMED_STATUS })
                ).toHaveCount(0)
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
              // The particle field's code fails while the page hydrates. The hero must stay, and no error page may replace it.
              const abortedParticles = yield* abortChunkHolding(
                page,
                PARTICLES_MARKER
              );
              yield* openRoute(page, "/en", "denied");
              const scene = page.locator("#scene");
              const error = scene.getByRole("alert");
              const retry = error.getByRole("button", { name: RETRY_NAME });

              // The page's own chunks load while it hydrates, so the scene's failure starts once they are in.
              yield* Effect.promise(() => page.waitForLoadState("networkidle"));
              yield* Effect.sync(() =>
                expect(MutableList.toArray(abortedParticles)).not.toEqual([])
              );
              yield* Effect.promise(() =>
                expect(
                  page.getByRole("heading", { level: 1, name: en.Error.title })
                ).toHaveCount(0)
              );
              yield* Effect.promise(() =>
                expect(
                  page.locator("#hero").getByRole("heading", { level: 1 })
                ).toBeVisible()
              );
              yield* Effect.promise(() =>
                expect(page.locator("#hero canvas")).toHaveCount(0)
              );

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
