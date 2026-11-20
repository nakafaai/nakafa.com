import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/** A lesson with a page outline, whose sidebar opens from the right on a phone or a tablet. */
const LESSON = "/en/subjects/chemistry/structure-matter/isotope";

/** The open sheet's distance from each screen edge, its corner's radius, and whether its bleed shows. */
const readSheet = (page: Page) =>
  page
    .locator('[data-mobile="true"][data-slot="sidebar"]')
    .evaluate((sheet) => {
      const box = sheet.getBoundingClientRect();
      return {
        bleed: Number(getComputedStyle(sheet, "::after").opacity),
        left: box.left,
        radius: Number.parseFloat(getComputedStyle(sheet).borderTopLeftRadius),
        right: window.innerWidth - box.right,
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
 * A phone's or a tablet's sidebar is a drawer that stands off the screen edge it opens from, its whole rounded
 * border in view on every side, light or dark: the fill that covers a pull past open never shows at rest, so the
 * sheet never looks cut off at the edge, from the left or from the right.
 */
for (const width of [320, 390, 768]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`at ${width}px in ${colorScheme} the sidebar sheet stands off the edge it opens from, its border whole`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ height: 844, width });
      await page.goto("/en/try-out");
      await openSheet(page, "Toggle Sidebar");
      const left = await readSheet(page);
      expect(left.bleed, "the left sheet's bleed at rest").toBe(0);
      expect(
        left.left,
        "the left sheet's gap to the screen edge"
      ).toBeGreaterThanOrEqual(4);
      expect(left.radius, "the left sheet's rounded corner").toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await page.goto(LESSON);
      await openSheet(page, "On this page");
      const right = await readSheet(page);
      expect(right.bleed, "the right sheet's bleed at rest").toBe(0);
      expect(
        right.right,
        "the right sheet's gap to the screen edge"
      ).toBeGreaterThanOrEqual(4);
    });
  }
}
