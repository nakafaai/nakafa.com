import {
  type APIResponse,
  expect,
  type Page,
  type Route,
} from "@playwright/test";
import type { AnalyticsConsentDecision } from "@repo/analytics/consent";
import { Deferred, Effect, MutableList } from "effect";
import { seedAnalyticsConsent } from "./consent";
import { servedTimeoutMilliseconds } from "./timeout";

/** The app routes that several suites open by name, in English and Indonesian. */
export const appRoutes = {
  quran: "/en/quran",
  quranId: "/id/quran",
  quranSurah: "/en/quran/2",
  quranSurahId: "/id/quran/2",
  settings: "/en/user/settings",
  tryout: "/en/try-out",
} as const;

/**
 * Waits until the server answers the page at `href` with 200. The Start server
 * renders every request, so the first answer that succeeds is the whole page, and
 * a check that reads the page starts once that answer arrives. A cold server that
 * is still starting answers with an error until then, so the wait polls.
 */
export const waitForServedRoute = Effect.fn("NakafaE2E.waitForServedRoute")(
  function* (page: Page, href: string) {
    yield* Effect.promise(() =>
      expect
        .poll(async () => (await page.request.get(href)).status(), {
          timeout: servedTimeoutMilliseconds,
        })
        .toBe(200)
    );
  }
);

/**
 * The JavaScript chunks of the app, as the Vite build writes them under
 * `/assets/`. Aborting them after a page has loaded fails whatever that page
 * loads next.
 */
export const APP_CHUNK_PATH = /\/assets\/.*\.js(?:\?.*)?$/;

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
    page.route(APP_CHUNK_PATH, (route) =>
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
 * Holds every JavaScript chunk of the app that the page asks for, until the
 * `release` it returns runs. A step holds the editor's code this way, so the
 * page shows what it draws while the code is on its way. Call it once the page
 * has loaded: a chunk that the page loads with it would wait for the release.
 * With `containing`, only a chunk whose code holds that text waits, and every
 * other chunk loads at once.
 */
export const holdChunks = Effect.fn("NakafaE2E.holdChunks")(function* (
  page: Page,
  options: { readonly containing?: string } = {}
) {
  const gate = yield* Deferred.make<void>();
  const services = yield* Effect.context<never>();
  yield* routeChunkHolding(page, options.containing ?? "", (route, response) =>
    Effect.andThen(
      Deferred.await(gate),
      Effect.promise(() => route.fulfill({ response }))
    )
  );
  return () =>
    Effect.runPromiseWith(services)(Deferred.succeed(gate, undefined));
});

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
