import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";

/** Reading pages whose header joins the page's actions with the outline toggle, which leaves from 1280 px. */
const PAGES = [
  "/en/subjects/chemistry/structure-matter/isotope",
  "/en/quran/1",
] as const;

/** The width from which the outline toggle leaves the header for the sidebar. */
const XL = 1280;

/** A control's four corner radii, in pixels. */
const cornersOf = (control: Locator) =>
  control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      bottomLeft: Number.parseFloat(style.borderBottomLeftRadius),
      bottomRight: Number.parseFloat(style.borderBottomRightRadius),
      topLeft: Number.parseFloat(style.borderTopLeftRadius),
      topRight: Number.parseFloat(style.borderTopRightRadius),
    };
  });

/**
 * A joined group's ends are round whatever hides: below 1280 px the actions and the outline toggle share one frame,
 * rounded at its two ends and square where they meet; from 1280 px the toggle leaves, and the actions alone are round
 * on both sides, never half round, in light and dark.
 */
for (const address of PAGES) {
  for (const width of [390, 1024, 1440, 1920]) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`${address} at ${width}px in ${colorScheme} rounds the header group's visible ends`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ height: 900, width });
        await page.goto(address);
        const more = page
          .getByRole("button", { name: "More actions" })
          .filter({ visible: true })
          .first();
        await expect(more).toBeVisible();
        const actions = await cornersOf(more);
        expect(actions.topLeft, "the actions' start").toBeGreaterThan(0);
        expect(actions.bottomLeft, "the actions' start").toBeGreaterThan(0);
        if (width >= XL) {
          expect(actions.topRight, "the lone actions' end").toBeGreaterThan(0);
          expect(actions.bottomRight, "the lone actions' end").toBeGreaterThan(
            0
          );
          return;
        }
        expect(actions.topRight, "where the actions meet the toggle").toBe(0);
        const toggle = page
          .getByRole("button", { name: "On this page" })
          .filter({ visible: true })
          .first();
        const end = await cornersOf(toggle);
        expect(end.topRight, "the toggle's end").toBeGreaterThan(0);
        expect(end.topLeft, "where the toggle meets the actions").toBe(0);
      });
    }
  }
}
