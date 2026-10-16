import {
  type APIResponse,
  expect,
  type Page,
  type Route,
} from "@playwright/test";
import type { AnalyticsConsentDecision } from "@repo/analytics/consent";
import { Effect, MutableList } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { cacheTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The app routes that several suites open by name, in English and Indonesian. */
export const appRoutes = {
  quran: "/en/quran",
  quranId: "/id/quran",
  quranSurah: "/en/quran/2",
  quranSurahId: "/id/quran/2",
  tryout: "/en/try-out",
} as const;

/**
 * Waits until Next.js has cached the page at `href`, which the server says with
 * `x-nextjs-cache: HIT`. A page whose params were not prerendered, such as a
 * surah past the first, is answered on its first visit with the shell of its
 * route, and the browser fetches the page itself after it loaded while Next.js
 * renders it in the background; every visit after that gets the cached page
 * whole. A check that reads the page would race that fetch, so it starts once
 * the server answers HIT.
 * @see https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components#at-runtime
 */
export const waitForCachedRoute = Effect.fn("NakafaE2E.waitForCachedRoute")(
  function* (page: Page, href: string) {
    yield* Effect.promise(() =>
      expect
        .poll(
          async () =>
            (await page.request.get(href)).headers()["x-nextjs-cache"],
          { timeout: cacheTimeoutMilliseconds }
        )
        .toBe("HIT")
    );
  }
);

/**
 * The JavaScript chunks of the app, as local Next and Vercel-promoted
 * production paths write them. Aborting them after a page has loaded fails
 * whatever that page loads next.
 */
export const NEXT_CHUNK_PATH =
  /\/_next\/static\/(?:immutable\/)?chunks\/.*\.js(?:\?.*)?$/;

/**
 * Routes every chunk the page asks for. A chunk whose code holds `marker` goes
 * to `onMatch` with its response, and every other chunk is fulfilled as the
 * server sent it. The chunk's text is read from the response, so the route
 * matches the module itself and not its name, which changes with each build.
 */
function routeChunkHolding(
  page: Page,
  marker: string,
  onMatch: (route: Route, response: APIResponse) => Effect.Effect<void>
) {
  return Effect.promise(() =>
    page.route(NEXT_CHUNK_PATH, (route) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const response = yield* Effect.promise(() => route.fetch());
          const body = yield* Effect.promise(() => response.text());
          if (body.includes(marker)) {
            return yield* onMatch(route, response);
          }
          return yield* Effect.promise(() => route.fulfill({ response }));
        })
      )
    )
  );
}

/**
 * Aborts the chunk whose code holds `marker`, while the page hydrates. The
 * result lists the URLs it aborted, in order, so a test can prove the failure
 * happened.
 */
export function abortChunkHolding(page: Page, marker: string) {
  const aborted = MutableList.make<string>();
  return Effect.as(
    routeChunkHolding(page, marker, (route) => {
      MutableList.append(aborted, route.request().url());
      return Effect.promise(() => route.abort("failed"));
    }),
    aborted
  );
}

/** Holds the chunk whose code holds `marker` for `milliseconds` before it loads. */
export function holdChunkHolding(
  page: Page,
  marker: string,
  milliseconds: number
) {
  return routeChunkHolding(page, marker, (route, response) =>
    Effect.andThen(
      Effect.sleep(milliseconds),
      Effect.promise(() => route.fulfill({ response }))
    )
  );
}

/**
 * Seeds one consent decision before the first navigation, then opens `href`
 * and expects the server to answer it with a page.
 */
export const openRoute = Effect.fn("NakafaE2E.openRoute")(function* (
  page: Page,
  href: string,
  consent: AnalyticsConsentDecision
) {
  yield* seedAnalyticsConsent(page, consent);
  const response = yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
});
