import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Deferred, Duration, Effect, MutableList } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import {
  PRELOADED_FONT_SELECTOR,
  readTypefaceFiles,
} from "@/e2e/support/fonts";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { settleRouter } from "@/e2e/support/navigation/settle";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { collectUnusedPreloads } from "@/e2e/support/preload";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** A second late: longer than a served page takes to paint, shorter than the 3 s block period. */
const lateTypefaceMilliseconds = 1000;

const verifyQuranTypefaceScope = Effect.fn(
  "NakafaE2E.verifyQuranTypefaceScope"
)(function* (page: Page) {
  yield* seedAnalyticsConsent(page, "denied");

  const warnings = yield* collectUnusedPreloads(
    page,
    Effect.gen(function* () {
      // The desktop sidebar links to the Quran. Intent over that link preloads
      // the Quran route, and the preload must not load the Quran typeface here.
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
      const quranLink = page
        .locator(`a[href="${appRoutes.quran}"]:visible`)
        .first();
      yield* settleRouter(
        page,
        Effect.promise(() => quranLink.hover())
      );
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
    return Arr.map(fonts, (font) => font.familyName);
  });
});

/**
 * A surah page renders Quran text, so the font loader preloads the Quran typeface
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
    expect(
      Arr.filter(files, (file) => Arr.contains(preloads, file))
    ).toHaveLength(2)
  );

  yield* openSurah(page, href);
  const fonts = yield* readQuranTextFonts(page);
  yield* Effect.sync(() => expect(fonts).toEqual(["Amiri Quran"]));
});

/**
 * Block display never draws Quran text in another face: a surah whose Amiri
 * Quran arrives a second late waits for it and then shows its words in it alone.
 * Routing bypasses the HTTP cache, so the second view requests the typeface
 * again and the route holds it back.
 */
const verifyLateTypefaceNeverShowsFallback = Effect.fn(
  "NakafaE2E.verifyLateTypefaceNeverShowsFallback"
)(function* (page: Page, surah: number) {
  yield* seedAnalyticsConsent(page, "denied");
  const href = `/en/quran/${surah}`;
  yield* openSurah(page, href);
  const files = yield* readTypefaceFiles(page);
  const held = MutableList.make<string>();
  const release = yield* Deferred.make<void>();
  const services = yield* Effect.context<never>();
  yield* Effect.promise(() =>
    page.route(
      (url) => Arr.contains(files, url.pathname),
      (route) => {
        MutableList.append(held, route.request().url());
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
  const fonts = yield* readQuranTextFonts(page);
  yield* Effect.sync(() => {
    expect(MutableList.toArray(held)).not.toHaveLength(0);
    expect(fonts).toEqual(["Amiri Quran"]);
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

    test(`shows surah ${surah} only in Amiri Quran when it arrives late`, async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          verifyLateTypefaceNeverShowsFallback(page, surah)
        )
      );
    });
  });
}
