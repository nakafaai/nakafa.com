import { expect, test } from "@playwright/test";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The lists, which name themselves in their path, as every list page does. */
const LISTS = [appRoutes.quran, "/en/articles", "/en/articles/politics"];

/**
 * The one reading page that names itself in its header, by the owner's word (9 Nov): the Quran is special, so a
 * surah's path ends at the surah, as a list's does, and its verses start under the header with no title block.
 */
const QURAN_SURAH = appRoutes.quranSurah;

/** The reading pages, which name themselves in the title block that opens their body. */
const READINGS = [pinnedRoutes.material.en, pinnedRoutes.article.en];

/**
 * A list, and the Quran's surah, is one header row over its body: the path ends at the page itself, its one heading
 * stands for assistive technology only, and its description reaches the head and the structured data, never the
 * page's column.
 */
for (const path of [...LISTS, QURAN_SURAH]) {
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

/**
 * The owner's rule (9 Nov): an article reads as a lesson does. Every reading page's header holds the path to its
 * parent and its actions, and its body opens with its one title, seen at every width; the path never names the page,
 * so no crumb is the current page and none repeats the title. The surah is the one exception (`QURAN_SURAH`).
 */
for (const path of READINGS) {
  for (const width of [390, 1440]) {
    test(`${path} opens its body with its title, and its path ends at its parent, at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(path);
      const title = page.locator("main h1");
      await expect(title).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });

      const read = await page.evaluate(() => {
        const headings = [...document.querySelectorAll("main h1")];
        const heading = headings[0];
        const header = document.querySelector('main [data-slot="page-header"]');
        // Every path the header holds: a lesson writes one per curriculum place, and shows one.
        const paths = [...(header?.querySelectorAll("nav") ?? [])];
        const text = heading?.textContent?.trim() ?? "";
        const crumbs = paths.flatMap((path) =>
          [...path.querySelectorAll("a")].map(
            (crumb) => crumb.textContent?.trim() ?? ""
          )
        );
        const box = heading?.getBoundingClientRect();
        return {
          current: paths.flatMap((path) => [
            ...path.querySelectorAll('[aria-current="page"]'),
          ]).length,
          headings: headings.length,
          inHeader: heading?.closest('[data-slot="page-header"]') !== null,
          namedInPath: text !== "" && crumbs.includes(text),
          underHeader:
            box !== undefined &&
            header !== null &&
            box.top >= header.getBoundingClientRect().bottom,
          wide: (box?.width ?? 0) > 1,
        };
      });
      expect(read).toEqual({
        current: 0,
        headings: 1,
        inHeader: false,
        namedInPath: false,
        underHeader: true,
        wide: true,
      });
    });
  }
}
