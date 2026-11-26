import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Lists whose rows carry titles that always show whole. */
const WHOLE_CATALOGS = ["/en/articles"];
/** Article card lists whose titles clamp to two lines so cards stay uniform. */
const CLAMPED_ARTICLE_CATALOGS = ["/en/articles/politics"];

/**
 * Reads every title of the page's cards and rows that is cut: one that a line
 * clamp or an ellipsis could shorten, or one whose words run past its box.
 */
function readCutTitles(page: Page) {
  return page.locator("main").evaluate((main) =>
    Array.from(main.querySelectorAll("h2, h3"))
      .filter((title) => title instanceof HTMLElement)
      .flatMap((title) => {
        // A card may clamp the box that holds its title rather than the title.
        const clamped = [title, title.parentElement].some((box) => {
          if (box === null) {
            return false;
          }
          const style = getComputedStyle(box);
          return (
            style.getPropertyValue("-webkit-line-clamp") !== "none" ||
            style.textOverflow === "ellipsis"
          );
        });
        const overflows =
          title.scrollWidth > title.clientWidth + 1 ||
          title.scrollHeight > title.clientHeight + 1;
        return clamped || overflows ? [title.textContent?.trim() ?? ""] : [];
      })
  );
}

/** Opens a catalog and proves that every title of its cards and rows shows whole. */
const verifyWholeTitles = Effect.fn("NakafaE2E.verifyWholeTitles")(function* (
  page: Page,
  path: string
) {
  const response = yield* Effect.promise(() =>
    page.goto(path, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* Effect.promise(async () => {
    await expect(page.locator("main h2").first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    expect(await readCutTitles(page)).toEqual([]);
  });
});

/** Opens an article category and proves its card titles clamp to two lines with uniform card heights. */
const verifyClampedArticleTitles = Effect.fn(
  "NakafaE2E.verifyClampedArticleTitles"
)(function* (page: Page, path: string) {
  const response = yield* Effect.promise(() =>
    page.goto(path, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* Effect.promise(async () => {
    await expect(page.locator("main h2").first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    const report = await page.locator("main").evaluate((main) => {
      const headings = Array.from(main.querySelectorAll("h2"));
      const unclamped = headings
        .filter((heading) => {
          const style = getComputedStyle(heading);
          const lineHeight = Number.parseFloat(style.lineHeight);
          const maxHeight = Number.isFinite(lineHeight)
            ? lineHeight * 2 + 2
            : 0;
          return (
            style.getPropertyValue("-webkit-line-clamp") !== "2" ||
            heading.getAttribute("title") !== heading.textContent?.trim() ||
            (maxHeight > 0 &&
              heading.getBoundingClientRect().height > maxHeight)
          );
        })
        .map((heading) => heading.textContent?.trim() ?? "");
      const heights = Array.from(
        main.querySelectorAll('[data-slot="card"]')
      ).map((card) => Math.round(card.getBoundingClientRect().height));
      return { count: headings.length, heights, unclamped };
    });
    expect(report.count).toBeGreaterThan(0);
    expect(report.unclamped).toEqual([]);
    expect(
      Math.max(...report.heights) - Math.min(...report.heights)
    ).toBeLessThanOrEqual(1);
  });
});

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test.describe(`card and row titles at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const path of WHOLE_CATALOGS) {
      test(`show whole on ${path}`, async ({ page }) => {
        await Effect.runPromise(
          withObservedPageErrors(page, verifyWholeTitles(page, path))
        );
      });
    }

    for (const path of CLAMPED_ARTICLE_CATALOGS) {
      test(`clamp article titles to two lines on ${path}`, async ({ page }) => {
        await Effect.runPromise(
          withObservedPageErrors(page, verifyClampedArticleTitles(page, path))
        );
      });
    }
  });
}
