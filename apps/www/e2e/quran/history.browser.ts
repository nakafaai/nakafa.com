import { expect, type Locator, type Page, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Counts the verse links whose rows lie inside the visible part of the outline. Runs in the page. */
function countVisibleVerseLinks(container: HTMLElement) {
  const box = container.getBoundingClientRect();
  return Array.from(container.querySelectorAll('a[href^="#verse-"]')).filter(
    (link) => {
      const row = link.getBoundingClientRect();
      return row.height > 0 && row.bottom > box.top && row.top < box.bottom;
    }
  ).length;
}

/** Waits until the outline shows verse links in its visible part. */
const expectOutlineEntries = Effect.fn("NakafaE2E.expectOutlineEntries")(
  function* (outline: Locator) {
    yield* Effect.promise(() =>
      expect
        .poll(() => outline.evaluate(countVisibleVerseLinks), {
          timeout: readinessTimeoutMilliseconds,
        })
        .toBeGreaterThan(0)
    );
  }
);

/** Waits until the page is back at the reading position it had when it was left. */
const expectReadingPosition = Effect.fn("NakafaE2E.expectReadingPosition")(
  function* (page: Page, readingY: number) {
    yield* Effect.promise(() =>
      expect
        .poll(
          async () =>
            Math.abs((await page.evaluate(() => window.scrollY)) - readingY),
          { timeout: readinessTimeoutMilliseconds }
        )
        .toBeLessThanOrEqual(1)
    );
  }
);

/** Waits until the address bar shows the page at `pathname`, whatever its fragment. */
const expectPathname = Effect.fn("NakafaE2E.expectPathname")(function* (
  page: Page,
  pathname: string
) {
  yield* Effect.promise(() =>
    expect
      .poll(() => new URL(page.url()).pathname, {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(pathname)
  );
});

/**
 * Scrolls the outline to verse 200 and reads the verse, then leaves the surah
 * for the Quran index with a client navigation. Back returns to the surah,
 * where the outline and the reading position must be the same as before, and
 * Forward and Back again must show the same once more.
 */
const verifyOutlineHistory = Effect.fn("NakafaE2E.verifyOutlineHistory")(
  function* (page: Page) {
    yield* seedAnalyticsConsent(page, "denied");
    yield* Effect.promise(() => page.goto(appRoutes.quranSurah));
    yield* waitForCommittedAppRouter(
      page,
      appRoutes.quranSurah,
      appRoutes.quranSurah,
      readinessTimeoutMilliseconds
    );
    const outline = page.locator(
      '[data-side="right"] [data-slot="sidebar-content"]'
    );
    yield* Effect.promise(() =>
      outline.getByRole("link", { exact: true, name: "Verse 200" }).click()
    );
    yield* Effect.sleep(Duration.seconds(1));
    const readingY = yield* Effect.promise(() =>
      page.evaluate(() => window.scrollY)
    );

    yield* Effect.promise(() =>
      page
        .getByRole("navigation", { name: "breadcrumb" })
        .getByRole("link", { exact: true, name: "Quran" })
        .click()
    );
    yield* expectPathname(page, appRoutes.quran);

    yield* Effect.promise(() => page.goBack());
    yield* expectPathname(page, appRoutes.quranSurah);
    yield* expectOutlineEntries(outline);
    yield* expectReadingPosition(page, readingY);

    yield* Effect.promise(() => page.goForward());
    yield* expectPathname(page, appRoutes.quran);

    yield* Effect.promise(() => page.goBack());
    yield* expectPathname(page, appRoutes.quranSurah);
    yield* expectOutlineEntries(outline);
    yield* expectReadingPosition(page, readingY);
  }
);

test.describe("Desktop surah history", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("shows the outline and the reading position after Back and Forward", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyOutlineHistory(page))
    );
  });
});
