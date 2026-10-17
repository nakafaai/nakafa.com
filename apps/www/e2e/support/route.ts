import { expect, type Page } from "@playwright/test";
import type { AnalyticsConsentDecision } from "@repo/analytics/consent";
import { Array as Arr, Deferred, Effect, Record as Rec } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { cacheTimeoutMilliseconds } from "@/e2e/support/timeout";

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
 * The headers that describe a body as the server compressed it. Playwright hands
 * a fetched body back decoded, so a chunk it fulfills drops both and the browser
 * reads the decoded body as it is.
 */
const COMPRESSED_BODY_HEADERS = ["content-encoding", "content-length"];

/**
 * Holds every JavaScript chunk of the app that the page asks for, until the
 * `release` it returns runs. A step holds the editor's code this way, so the
 * page shows what it draws while the code is on its way. Call it once the page
 * has loaded: a chunk that the page loads with it would wait for the release.
 *
 * With `containing`, only a chunk whose code holds that text waits, and every
 * other chunk loads at once. Every chunk is fetched once to read its code, and
 * the page then receives that same code.
 */
export const holdChunks = Effect.fn("NakafaE2E.holdChunks")(function* (
  page: Page,
  options: { readonly containing?: string } = {}
) {
  const gate = yield* Deferred.make<void>();
  const services = yield* Effect.context<never>();

  yield* Effect.promise(() =>
    page.route(NEXT_CHUNK_PATH, async (route) => {
      const { containing } = options;
      if (containing === undefined) {
        await Effect.runPromiseWith(services)(Deferred.await(gate));
        await route.continue();
        return;
      }
      const response = await route.fetch();
      const code = await response.body();
      if (code.includes(containing)) {
        await Effect.runPromiseWith(services)(Deferred.await(gate));
      }
      await route.fulfill({
        body: code,
        headers: Rec.filter(
          response.headers(),
          (_value, name) => !Arr.contains(COMPRESSED_BODY_HEADERS, name)
        ),
        status: response.status(),
      });
    })
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
