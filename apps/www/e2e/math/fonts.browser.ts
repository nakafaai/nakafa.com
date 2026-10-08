import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/context";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { collectUnusedPreloads } from "@/e2e/support/preload";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const cacheTimeoutMilliseconds = 30_000;
const lesson = pinnedRoutes.inverse.en;
const katexFile = /\/KaTeX_([^./]+)\.[^/]+\.woff2$/;
const lessonPath = /^\/en\/subjects\//;

interface LoadedFontFace {
  readonly family: string;
  readonly style: string;
  readonly weight: string;
}

/** Names a KaTeX file the way KaTeX does, such as `Main-Regular`. */
function fileFace(url: string) {
  return katexFile.exec(new URL(url).pathname)?.[1];
}

/** Names a loaded KaTeX face the way its file is named. */
function loadedFace({ family, style, weight }: LoadedFontFace) {
  if (!family.startsWith("KaTeX_")) {
    return;
  }
  const bold = weight === "bold" || weight === "700" ? "Bold" : "";
  const italic = style === "italic" ? "Italic" : "";
  return `${family.slice("KaTeX_".length)}-${bold + italic || "Regular"}`;
}

/** Reads which KaTeX faces the page preloads, fetches, and draws with. */
const readMathFonts = Effect.fn("NakafaE2E.readMathFonts")(function* (
  page: Page
) {
  const state = yield* Effect.promise(() =>
    page.evaluate(() => ({
      fetched: performance
        .getEntriesByType("resource")
        .filter((entry) => entry instanceof PerformanceResourceTiming)
        .map((entry) => ({ initiator: entry.initiatorType, url: entry.name })),
      loaded: [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map(({ family, style, weight }) => ({ family, style, weight })),
      preloaded: [
        ...document.querySelectorAll<HTMLLinkElement>(
          'link[rel="preload"][as="font"]'
        ),
      ].map((link) => link.href),
    }))
  );
  return {
    fetched: state.fetched.flatMap(({ initiator, url }) => {
      const face = fileFace(url);
      return face ? [`${face} ${initiator}`] : [];
    }),
    loaded: state.loaded.flatMap((font) => loadedFace(font) ?? []),
    preloaded: state.preloaded.flatMap((url) => fileFace(url) ?? []),
  };
});

/**
 * Most lessons render on demand, and later readers get the page Next cached
 * then, so the check reads that cached page.
 */
const verifyCachedLessonFonts = Effect.fn("NakafaE2E.verifyCachedLessonFonts")(
  function* (page: Page) {
    yield* seedAnalyticsConsent(page, "denied");
    yield* Effect.promise(() =>
      expect
        .poll(
          async () =>
            (await page.request.get(lesson)).headers()["x-nextjs-cache"],
          { timeout: cacheTimeoutMilliseconds }
        )
        .toBe("HIT")
    );
    const warnings = yield* collectUnusedPreloads(
      page,
      Effect.gen(function* () {
        yield* Effect.promise(() => page.goto(lesson));
        yield* waitForCommittedAppRouter(
          page,
          lesson,
          lesson,
          readinessTimeoutMilliseconds
        );
      })
    );
    const fonts = yield* readMathFonts(page);

    yield* Effect.sync(() => {
      expect(fonts.preloaded.length).toBeGreaterThan(0);
      expect(new Set(fonts.preloaded).size).toBe(fonts.preloaded.length);
      // The stylesheet's request reuses each preload instead of fetching again.
      expect([...fonts.fetched].sort()).toEqual(
        fonts.preloaded.map((face) => `${face} link`).sort()
      );
      expect([...fonts.loaded].sort()).toEqual([...fonts.preloaded].sort());
      expect(warnings).toEqual([]);
    });
  }
);

/**
 * Chromium never matches a font preload that script inserts with the
 * stylesheet's request, so a client navigation must add none.
 */
const verifyNavigationFonts = Effect.fn("NakafaE2E.verifyNavigationFonts")(
  function* (page: Page) {
    yield* seedAnalyticsConsent(page, "denied");
    yield* Effect.promise(() => page.goto(lesson));
    yield* waitForCommittedAppRouter(
      page,
      lesson,
      lesson,
      readinessTimeoutMilliseconds
    );
    const inserted = yield* Effect.promise(() =>
      page.evaluateHandle(() => {
        const hrefs: string[] = [];
        new MutationObserver((records) => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (
                node instanceof HTMLLinkElement &&
                node.rel === "preload" &&
                node.as === "font"
              ) {
                hrefs.push(node.href);
              }
            }
          }
        }).observe(document.head, { childList: true });
        return hrefs;
      })
    );
    const previous = page
      .getByRole("navigation", { name: "Pagination navigation" })
      .locator('a[href^="/en/subjects/"]')
      .first();
    const target = yield* Effect.promise(() => previous.getAttribute("href"));
    yield* Effect.sync(() => {
      expect(target).toMatch(lessonPath);
      expect(target).not.toBe(lesson);
    });
    const warnings = yield* collectUnusedPreloads(
      page,
      Effect.gen(function* () {
        yield* Effect.promise(() => previous.click());
        yield* Effect.promise(() =>
          page.waitForURL((url) => url.pathname === target)
        );
        yield* Effect.promise(() =>
          expect(page.locator("article .katex").first()).toBeVisible()
        );
      })
    );
    const hrefs = yield* Effect.promise(() => inserted.jsonValue());

    yield* Effect.sync(() => {
      expect(hrefs).toEqual([]);
      expect(warnings).toEqual([]);
    });
  }
);

test.describe("Math fonts", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("a cached lesson preloads each face its math draws, once", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyCachedLessonFonts(page))
    );
  });

  test("a client navigation into a lesson adds no font preloads", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyNavigationFonts(page))
    );
  });
});
