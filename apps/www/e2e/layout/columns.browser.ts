import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

// The shared content column's cap, Tailwind's max-w-3xl.
const columnMaxWidth = 768;
// Pages whose lists are narrower than the column, so a shrinking column shows.
const columnRoutes = [
  appRoutes.quranId,
  "/en/articles",
  "/en/articles/politics",
];
const tryoutSetRoute = "/en/try-out/indonesia/snbt/2027/set-1";

const visit = Effect.fn("NakafaE2E.visitLayoutRoute")(function* (
  page: Page,
  href: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(href));
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
});

/** The page column spans the app shell's width up to the shared cap. */
const verifyContentColumn = Effect.fn("NakafaE2E.verifyContentColumn")(
  function* (page: Page, href: string) {
    yield* visit(page, href);
    yield* Effect.promise(() =>
      expect(page.locator("main article").first()).toBeVisible()
    );
    const widths = yield* Effect.promise(() =>
      page.evaluate(() => ({
        column: Math.round(
          document.querySelector("main article")?.getBoundingClientRect()
            .width ?? 0
        ),
        shell: Math.round(
          document
            .querySelector('main[data-slot="sidebar-inset"]')
            ?.getBoundingClientRect().width ?? 0
        ),
      }))
    );

    yield* Effect.sync(() =>
      expect(widths.column).toBe(Math.min(widths.shell, columnMaxWidth))
    );
  }
);

/** A try-out page reaches the screen's bottom, so a locked review ends there. */
const verifyTryoutHeight = Effect.fn("NakafaE2E.verifyTryoutHeight")(function* (
  page: Page
) {
  yield* visit(page, tryoutSetRoute);
  yield* Effect.promise(() =>
    expect(page.locator('main [data-slot="tryout-page"]')).toBeVisible()
  );
  const heights = yield* Effect.promise(() =>
    page.evaluate(() => ({
      bottom: Math.round(
        document
          .querySelector('main [data-slot="tryout-page"]')
          ?.getBoundingClientRect().bottom ?? 0
      ),
      document: document.documentElement.scrollHeight,
      screen: window.innerHeight,
    }))
  );

  yield* Effect.sync(() => {
    expect(heights.bottom).toBe(heights.screen);
    expect(heights.document).toBe(heights.screen);
  });
});

for (const width of [390, 1440]) {
  test.describe(`Content column at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    for (const href of columnRoutes) {
      test(`${href} spans the shared column`, async ({ page }) => {
        await Effect.runPromise(
          withObservedPageErrors(page, verifyContentColumn(page, href))
        );
      });
    }
  });

  test.describe(`Try-out page at ${width}px`, () => {
    // Taller than the set page, so the page has to fill the rest.
    test.use({ viewport: { height: 1400, width } });

    test("fills the screen below the app header", async ({ page }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyTryoutHeight(page))
      );
    });
  });
}
