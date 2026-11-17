import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
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
// Reading pages, whose header, title, body and footer all stand in the column.
const readingRoutes = [
  "/en/subjects/chemistry/structure-matter/isotope",
  "/en/articles/politics/merah-putih-cabinet-analysis",
];
const tryoutSetRoute = "/en/try-out/indonesia/snbt/2027/utbk/set-1";

const visit = Effect.fn("NakafaE2E.visitLayoutRoute")(function* (
  page: Page,
  href: string
) {
  yield* Effect.promise(() => page.goto(href));
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
});

/** The page's body, whichever kind the page has: a reading flow, a stack of sections, or a list in its card. */
const BODY =
  'main :is(article, [data-slot="page-stack"], [data-slot="page-list"])';

/** The page column spans the app shell's width up to the shared cap. */
const verifyContentColumn = Effect.fn("NakafaE2E.verifyContentColumn")(
  function* (page: Page, href: string) {
    yield* visit(page, href);
    yield* Effect.promise(() =>
      expect(page.locator(BODY).first()).toBeVisible()
    );
    const widths = yield* Effect.promise(() =>
      page.evaluate(
        (body) => ({
          column: Math.round(
            document.querySelector(body)?.getBoundingClientRect().width ?? 0
          ),
          shell: Math.round(
            document
              .querySelector('main[data-slot="sidebar-inset"]')
              ?.getBoundingClientRect().width ?? 0
          ),
        }),
        BODY
      )
    );

    yield* Effect.sync(() =>
      expect(widths.column).toBe(Math.min(widths.shell, columnMaxWidth))
    );
  }
);

/**
 * A try-out page's least height reaches the screen's bottom, so a locked review ends there. A set page
 * with its samples runs past the screen, so its least height is measured, not its bottom.
 */
const verifyTryoutHeight = Effect.fn("NakafaE2E.verifyTryoutHeight")(function* (
  page: Page
) {
  yield* visit(page, tryoutSetRoute);
  yield* Effect.promise(() =>
    expect(page.locator('main [data-slot="tryout-page"]')).toBeVisible()
  );
  const heights = yield* Effect.promise(() =>
    page.evaluate(() => {
      const tryout = document.querySelector('main [data-slot="tryout-page"]');
      const top = (tryout?.getBoundingClientRect().top ?? 0) + window.scrollY;
      const least = tryout
        ? Number.parseFloat(getComputedStyle(tryout).minHeight)
        : 0;
      return { reach: Math.round(top + least), screen: window.innerHeight };
    })
  );

  yield* Effect.sync(() => expect(heights.reach).toBe(heights.screen));
});

/**
 * A reading page's rows: its header's at the page's frame, and its title's and its body's in the reading column under
 * it, starting on the header row's start edge, so the path and the body share one line and the body is never wider.
 */
const verifyReadingColumn = Effect.fn("NakafaE2E.verifyReadingColumn")(
  function* (page: Page, href: string) {
    yield* verifyContentColumn(page, href);
    const rows = yield* Effect.promise(() =>
      page.evaluate(() => {
        const boxOf = (element: Element | null | undefined) => {
          const box = element?.getBoundingClientRect();
          return {
            left: Math.round(box?.left ?? 0),
            width: Math.round(box?.width ?? 0),
          };
        };
        return {
          body: boxOf(document.querySelector('[data-slot="page-body"]')),
          header: boxOf(
            document.querySelector(
              '[data-slot="page-header"] [class*="@container/header"]'
            )
          ),
          title: boxOf(document.querySelector("main h1")?.parentElement),
        };
      })
    );
    yield* Effect.sync(() => {
      expect(rows.title, "the title's row").toEqual(rows.body);
      expect(rows.body.left, "the body's start").toBe(rows.header.left);
      expect(rows.header.width, "the header's row").toBeGreaterThanOrEqual(
        rows.body.width
      );
    });
  }
);

for (const width of [390, 1024, 1440, 1920]) {
  test.describe(`Reading column at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    for (const href of readingRoutes) {
      test(`${href} reads in the shared column`, async ({ page }) => {
        await Effect.runPromise(
          withObservedPageErrors(page, verifyReadingColumn(page, href))
        );
      });
    }
  });
}

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
    test.use({ viewport: { height: 1400, width } });

    test("fills the screen below the app header", async ({ page }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyTryoutHeight(page))
      );
    });
  });
}
