import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readMathFonts } from "@/e2e/support/fonts";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { collectUnusedPreloads } from "@/e2e/support/preload";
import { paginationNavigation } from "@/e2e/support/selector";
import {
  cacheTimeoutMilliseconds,
  readinessTimeoutMilliseconds,
} from "@/e2e/support/timeout";

const lessonPath = /^\/en\/subjects\//;

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
            (await page.request.get(pinnedRoutes.inverse.en)).headers()[
              "x-nextjs-cache"
            ],
          { timeout: cacheTimeoutMilliseconds }
        )
        .toBe("HIT")
    );
    const warnings = yield* collectUnusedPreloads(
      page,
      Effect.gen(function* () {
        yield* Effect.promise(() => page.goto(pinnedRoutes.inverse.en));
        yield* waitForCommittedAppRouter(
          page,
          pinnedRoutes.inverse.en,
          pinnedRoutes.inverse.en,
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
    yield* Effect.promise(() => page.goto(pinnedRoutes.inverse.en));
    yield* waitForCommittedAppRouter(
      page,
      pinnedRoutes.inverse.en,
      pinnedRoutes.inverse.en,
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
    const previous = paginationNavigation(page)
      .locator('a[href^="/en/subjects/"]')
      .first();
    const target = yield* Effect.promise(() => previous.getAttribute("href"));
    yield* Effect.sync(() => {
      expect(target).toMatch(lessonPath);
      expect(target).not.toBe(pinnedRoutes.inverse.en);
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
