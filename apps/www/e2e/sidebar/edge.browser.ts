import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/** A lesson with a page outline, whose sidebar opens from the right on a phone or a tablet. */
const LESSON = "/en/subjects/chemistry/structure-matter/isotope";

/**
 * The open sheet's distance from each screen edge, its height against the screen's, and the radius of its corners on
 * the edge it opens from and on the edge facing the page.
 */
const readSheet = (page: Page) =>
  page
    .locator('[data-mobile="true"][data-slot="sidebar"]')
    .evaluate((sheet) => {
      const card = sheet.closest('[data-slot="drawer-content"]') ?? sheet;
      const box = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      return {
        bottom: Math.round(window.innerHeight - box.bottom),
        left: Math.round(box.left),
        leftRadius: Number.parseFloat(style.borderTopLeftRadius),
        right: Math.round(window.innerWidth - box.right),
        rightRadius: Number.parseFloat(style.borderTopRightRadius),
        top: Math.round(box.top),
      };
    });

/** Opens the sheet a trigger names and waits until it has slid all the way in. */
const openSheet = async (page: Page, name: string) => {
  await page
    .getByRole("button", { name })
    .filter({ visible: true })
    .first()
    .click();
  const sheet = page.locator('[data-mobile="true"][data-slot="sidebar"]');
  await expect(sheet).toBeVisible();
  await expect
    .poll(async () => {
      const box = await sheet.boundingBox();
      return box === null ? Number.NaN : Math.round(box.x);
    })
    .toBeGreaterThanOrEqual(0);
  await page.waitForTimeout(600);
};

/**
 * A phone's or a tablet's sidebar is a drawer as tall as the screen, flush on the edge it opens from, as every drawer
 * is flush on its edge: rounded only on the corners facing the page, light or dark, from the left or from the right.
 */
for (const width of [320, 390, 768]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`at ${width}px in ${colorScheme} the sidebar sheet stands flush on the edge it opens from, as tall as the screen`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ height: 844, width });
      await page.goto("/en/try-out");
      await openSheet(page, "Toggle Sidebar");
      const left = await readSheet(page);
      expect(left.left, "the left sheet's gap to its edge").toBe(0);
      expect(left.top, "the left sheet's gap to the top").toBe(0);
      expect(left.bottom, "the left sheet's gap to the bottom").toBe(0);
      expect(left.leftRadius, "the left sheet's outer corner").toBe(0);
      expect(left.rightRadius, "the left sheet's inner corner").toBeGreaterThan(
        0
      );
      await page.keyboard.press("Escape");
      await page.goto(LESSON);
      await openSheet(page, "On this page");
      const right = await readSheet(page);
      expect(right.right, "the right sheet's gap to its edge").toBe(0);
      expect(right.top, "the right sheet's gap to the top").toBe(0);
      expect(right.bottom, "the right sheet's gap to the bottom").toBe(0);
      expect(right.rightRadius, "the right sheet's outer corner").toBe(0);
      expect(
        right.leftRadius,
        "the right sheet's inner corner"
      ).toBeGreaterThan(0);
    });
  }
}
