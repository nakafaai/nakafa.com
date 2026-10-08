import { expect, type Page, test } from "@playwright/test";
import { Deferred, Duration, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import {
  PRELOADED_FONT_SELECTOR,
  readTypefaceFiles,
} from "@/e2e/support/fonts";
import { readLayoutShift } from "@/e2e/support/layout";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { collectUnusedPreloads } from "@/e2e/support/preload";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Longer than the 100 ms block period of optional display. */
const lateTypefaceMilliseconds = 1000;

const verifyQuranTypefaceScope = Effect.fn(
  "NakafaE2E.verifyQuranTypefaceScope"
)(function* (page: Page) {
  yield* seedAnalyticsConsent(page, "denied");

  const warnings = yield* collectUnusedPreloads(
    page,
    Effect.gen(function* () {
      // The desktop sidebar links to the Quran, so this page prefetches its
      // route; the prefetch must not preload the Quran typeface here.
      const quranPrefetch = page.waitForRequest(
        (request) =>
          new URL(request.url()).pathname === appRoutes.quran &&
          request.headers()["next-router-prefetch"] !== undefined,
        { timeout: readinessTimeoutMilliseconds }
      );
      const href = appRoutes.tryout;
      yield* Effect.promise(() =>
        page.goto(href, { waitUntil: "domcontentloaded" })
      );
      yield* waitForCommittedAppRouter(
        page,
        href,
        href,
        readinessTimeoutMilliseconds
      );
      yield* Effect.promise(() => quranPrefetch);
      yield* Effect.promise(() => page.waitForLoadState("networkidle"));
    })
  );
  yield* Effect.sync(() => expect(warnings).toEqual([]));
});

/** Opens a surah and waits until it hydrates. */
const openSurah = Effect.fn("NakafaE2E.openSurah")(function* (
  page: Page,
  href: string
) {
  yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
});

/** Reads the font families the browser drew the opening Quran text in. */
const readQuranTextFonts = Effect.fn("NakafaE2E.readQuranTextFonts")(function* (
  page: Page
) {
  const cdp = yield* Effect.promise(() => page.context().newCDPSession(page));
  return yield* Effect.promise(async () => {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "[data-quran-bismillah] p",
    });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", {
      nodeId,
    });
    return fonts.map((font) => font.familyName);
  });
});

/**
 * A surah page renders Quran text, so next/font preloads the Quran typeface
 * there: the Arabic subset for the words and the Latin subset for the spaces
 * between them. The next surah view draws its text in the cached typeface.
 */
const verifySurahPreloadsTypeface = Effect.fn(
  "NakafaE2E.verifySurahPreloadsTypeface"
)(function* (page: Page) {
  yield* seedAnalyticsConsent(page, "denied");
  const href = appRoutes.quranSurah;
  yield* openSurah(page, href);
  const files = yield* readTypefaceFiles(page);
  const preloads = yield* Effect.promise(() =>
    page
      .locator(PRELOADED_FONT_SELECTOR)
      .evaluateAll((links) =>
        links.map(
          (link) =>
            new URL(link.getAttribute("href") ?? "", location.href).pathname
        )
      )
  );
  yield* Effect.sync(() =>
    expect(files.filter((file) => preloads.includes(file))).toHaveLength(2)
  );

  yield* openSurah(page, href);
  const fonts = yield* readQuranTextFonts(page);
  yield* Effect.sync(() => expect(fonts).toContain("Amiri"));
});

/**
 * Optional display never swaps a late typeface in, so a surah whose Amiri
 * arrives after the block period keeps the system face it was laid out in
 * and stays still. Routing bypasses the HTTP cache, so the second view
 * requests the typeface again and the route holds it back.
 */
const verifyLateTypefaceKeepsSurahStill = Effect.fn(
  "NakafaE2E.verifyLateTypefaceKeepsSurahStill"
)(function* (page: Page, surah: number) {
  yield* seedAnalyticsConsent(page, "denied");
  const href = `/en/quran/${surah}`;
  yield* openSurah(page, href);
  const files = yield* readTypefaceFiles(page);
  const held: string[] = [];
  const release = yield* Deferred.make<void>();
  const services = yield* Effect.context<never>();
  yield* Effect.promise(() =>
    page.route(
      (url) => files.includes(url.pathname),
      (route) => {
        held.push(route.request().url());
        return Effect.runPromiseWith(services)(
          Deferred.await(release).pipe(
            Effect.andThen(() => Effect.promise(() => route.continue()))
          )
        );
      }
    )
  );

  yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sleep(Duration.millis(lateTypefaceMilliseconds));
  yield* Deferred.succeed(release, undefined);
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() => page.waitForLoadState("networkidle"));
  const layoutShift = yield* readLayoutShift(page);
  const fonts = yield* readQuranTextFonts(page);
  yield* Effect.sync(() => {
    expect(held).not.toHaveLength(0);
    expect(fonts).not.toContain("Amiri");
    expect(layoutShift).toBe(0);
  });
});

test.describe("Quran typeface", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("stays off the pages that only link to the Quran", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyQuranTypefaceScope(page))
    );
  });

  test("preloads on the surah pages that render it", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifySurahPreloadsTypeface(page))
    );
  });
});

for (const [device, viewport, surah] of [
  ["phone", { height: 844, width: 390 }, 112],
  ["desktop", { height: 900, width: 1440 }, 72],
] as const) {
  test.describe(`Quran typeface on a ${device}`, () => {
    test.use({ viewport });

    test(`keeps surah ${surah} still when it arrives late`, async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          verifyLateTypefaceKeepsSurahStill(page, surah)
        )
      );
    });
  });
}
