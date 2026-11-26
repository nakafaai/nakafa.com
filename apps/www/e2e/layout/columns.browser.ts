import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

// The shared content column's cap (max-w-3xl) and the catalog frame's cap (max-w-4xl).
const columnMaxWidth = 768;
const catalogMaxWidth = 896;
// Pages whose lists are narrower than the column, so a shrinking column shows.
const columnRoutes = [
  appRoutes.quranId,
  "/en/articles",
  "/en/articles/politics",
];
// Catalog pages whose header and card grid share the wider 4xl frame.
const catalogRoutes = [
  "/en/curricula",
  "/en/curriculum/merdeka",
  "/en/try-out/indonesia",
];
// Reading pages, whose header, title, body and footer all stand in the column.
const readingRoutes = [
  "/en/subjects/chemistry/structure-matter/isotope",
  "/en/articles/politics/merah-putih-cabinet-analysis",
];

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

/** The page column spans the app shell's width up to the given cap. */
const verifyContentColumn = Effect.fn("NakafaE2E.verifyContentColumn")(
  function* (page: Page, href: string, maxWidth: number = columnMaxWidth) {
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
      expect(widths.column).toBe(Math.min(widths.shell, maxWidth))
    );
  }
);

/**
 * A reading page's header contents, title, body and footer contents share the same centered column.
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
          footer: boxOf(
            document.querySelector('[data-slot="page-footer"] > div')
          ),
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
      expect(rows.header, "the header row").toEqual(rows.body);
      expect(rows.footer, "the footer row").toEqual(rows.body);
    });
  }
);

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
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

    for (const href of catalogRoutes) {
      test(`${href} spans the 4xl catalog frame`, async ({ page }) => {
        await Effect.runPromise(
          withObservedPageErrors(
            page,
            verifyContentColumn(page, href, catalogMaxWidth)
          )
        );
        const grid = page.locator('[data-slot="catalog-grid"]');
        await expect(grid).toBeVisible();
        expect(
          await grid.evaluate(
            (element) =>
              getComputedStyle(element).gridTemplateColumns.split(" ").length
          )
        ).toBe(width === 390 ? 1 : 3);
      });
    }
  });
}
