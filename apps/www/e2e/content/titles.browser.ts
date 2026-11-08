import { expect, test } from "@playwright/test";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The pages that name themselves in their path, as every page header does. */
const PAGES = [
  appRoutes.quran,
  appRoutes.quranSurah,
  "/en/articles",
  "/en/articles/politics",
  pinnedRoutes.article.en,
];

/**
 * The Quran's pages and the articles' pages are one header row over their body,
 * as every page is: the path ends at the page itself, its one heading stands for
 * assistive technology only, and the page's description reaches the head and the
 * structured data, never the page's column.
 */
for (const path of PAGES) {
  test(`${path} names itself in its path and keeps its description off the screen`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(path);
    const header = page.locator('main [data-slot="page-header"]').first();
    const current = header
      .getByRole("navigation", { name: "breadcrumb" })
      .locator('[aria-current="page"]:visible');
    await expect(current).toHaveCount(1, {
      timeout: readinessTimeoutMilliseconds,
    });

    const read = await page.evaluate(() => {
      const headings = [...document.querySelectorAll("main h1")];
      const description =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content") ?? "";
      // The page's column, not the outline panel beside it, whose header names the page in one line.
      const shown = [...document.querySelectorAll("main p")]
        .filter(
          (paragraph) =>
            paragraph.checkVisibility() && paragraph.closest("aside") === null
        )
        .map((paragraph) => paragraph.textContent?.trim() ?? "");
      return {
        headings: headings.length,
        inHeader: headings.every(
          (heading) => heading.closest('[data-slot="page-header"]') !== null
        ),
        offScreen: headings.every(
          (heading) => heading.getBoundingClientRect().width <= 1
        ),
        shownDescription: description !== "" && shown.includes(description),
      };
    });
    expect(read).toEqual({
      headings: 1,
      inHeader: true,
      offScreen: true,
      shownDescription: false,
    });
    await expect(page.locator("main h1")).toContainText(
      (await current.textContent()) ?? ""
    );
  });
}
