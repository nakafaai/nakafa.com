import { expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { LESSON_PATH } from "@/e2e/support/chat";

/** The widths of two phones, a tablet and a desktop. */
const WIDTHS = [320, 390, 768, 1440];

/**
 * The owner's footer (8 Nov 2026): a lesson ends on its previous and next, then a line as wide as the page,
 * the same width as the line under its header, then its comments, with the same space above the line as
 * below it.
 */
for (const width of WIDTHS) {
  test(`a lesson's comments open on a line as wide as its header's at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto(LESSON_PATH);
    const footer = page.locator("footer:has(#comments)");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();

    const lines = await page.evaluate((label) => {
      const header = document.querySelector('[data-slot="page-header"]');
      const pages = document.querySelector(`nav[aria-label="${label}"]`);
      const ruled = document.querySelector("footer:has(#comments)");
      const row = ruled?.firstElementChild;
      if (!(header && pages && ruled && row)) {
        return null;
      }
      const headerBox = header.getBoundingClientRect();
      const footerBox = ruled.getBoundingClientRect();
      const rule = Number.parseFloat(getComputedStyle(ruled).borderTopWidth);
      return {
        above: footerBox.top - pages.getBoundingClientRect().bottom,
        below: row.getBoundingClientRect().top - footerBox.top - rule,
        header: {
          left: headerBox.left,
          line: Number.parseFloat(getComputedStyle(header).borderBottomWidth),
          right: headerBox.right,
        },
        footer: { left: footerBox.left, line: rule, right: footerBox.right },
      };
    }, app.Common["page-navigation"]);

    expect(lines).not.toBeNull();
    expect(lines?.footer.line).toBeGreaterThan(0);
    expect(lines?.footer.line).toBe(lines?.header.line);
    expect(lines?.footer.left).toBeCloseTo(lines?.header.left ?? 0, 0);
    expect(lines?.footer.right).toBeCloseTo(lines?.header.right ?? 0, 0);
    expect(lines?.above).toBeCloseTo(lines?.below ?? 0, 0);
  });
}
