import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { LESSON_PATH } from "@/e2e/support/chat";

/** The widths of two phones, a tablet and a desktop. */
const WIDTHS = [320, 390, 768, 1440];

/** An article, whose body ends straight on its footer. */
const ARTICLE_PATH = "/en/articles/politics/merah-putih-cabinet-analysis";

/**
 * Opens a page at a width, brings its comments' footer into view, and measures the line under its header,
 * the line its footer opens on, and, on a lesson, the space between its previous and next and that line and
 * the space between the line and the comments.
 */
async function readFooterLines(page: Page, path: string, width: number) {
  await page.setViewportSize({ height: 900, width });
  await page.goto(path);
  const footer = page.locator("footer:has(#comments)");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();

  const lines = await page.evaluate((label) => {
    const header = document.querySelector('[data-slot="page-header"]');
    const ruled = document.querySelector("footer:has(#comments)");
    const row = ruled?.firstElementChild;
    if (!(header && ruled && row)) {
      return null;
    }
    const headerBox = header.getBoundingClientRect();
    const footerBox = ruled.getBoundingClientRect();
    const rule = Number.parseFloat(getComputedStyle(ruled).borderTopWidth);
    const pages = document.querySelector(`nav[aria-label="${label}"]`);
    return {
      above:
        pages === null
          ? null
          : footerBox.top - pages.getBoundingClientRect().bottom,
      below: row.getBoundingClientRect().top - footerBox.top - rule,
      footer: { left: footerBox.left, line: rule, right: footerBox.right },
      header: {
        left: headerBox.left,
        line: Number.parseFloat(getComputedStyle(header).borderBottomWidth),
        right: headerBox.right,
      },
    };
  }, app.Common["page-navigation"]);

  expect(lines).not.toBeNull();
  expect(lines?.footer.line).toBeGreaterThan(0);
  expect(lines?.footer.line).toBe(lines?.header.line);
  expect(lines?.footer.left).toBeCloseTo(lines?.header.left ?? 0, 0);
  expect(lines?.footer.right).toBeCloseTo(lines?.header.right ?? 0, 0);
  return lines;
}

/**
 * The owner's footer (8 Nov 2026): a lesson ends on its previous and next, then a line as wide as the page,
 * the same width as the line under its header, then its comments, with the same space above the line as
 * below it. An article has no previous and next, so its body ends on that line.
 */
for (const width of WIDTHS) {
  test(`a lesson's comments open on a line as wide as its header's at ${width}px`, async ({
    page,
  }) => {
    const lines = await readFooterLines(page, LESSON_PATH, width);
    expect(lines?.above).toBeCloseTo(lines?.below ?? 0, 0);
  });

  test(`an article's comments open on a line as wide as its header's at ${width}px`, async ({
    page,
  }) => {
    const lines = await readFooterLines(page, ARTICLE_PATH, width);
    expect(lines?.above).toBeNull();
  });
}
