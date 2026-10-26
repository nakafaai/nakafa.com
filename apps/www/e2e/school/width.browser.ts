import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";

/** The policy cards of a school's settings: students' threads and the email domains. */
const POLICY_CARDS = 2;

for (const width of [390, 1440]) {
  test(`the settings cards fill the page's width, side by side on a laptop and stacked on a phone, at ${width}`, async ({
    baseURL,
    browser,
  }) => {
    const school = await Effect.runPromise(createSchool());
    const address = (path: string) =>
      hostAddress(baseURL, `${school.slug}.localhost`, path);
    const context = await browser.newContext({
      viewport: { height: 900, width },
    });
    await Effect.runPromise(signInOwner(context, school.slug, address("/")));
    const page = await context.newPage();

    await page.goto(address("/settings/policies"));
    const cards = page.locator('[data-slot="card"]');
    await expect(cards).toHaveCount(POLICY_CARDS);
    const header = await page
      .locator('[data-slot="page-header"]')
      .boundingBox();
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    const span = (second?.x ?? 0) + (second?.width ?? 0) - (first?.x ?? 0);

    if (width === 1440) {
      // Two cards share one row, as tall as each other, across the width less the page padding.
      expect(second?.y).toBe(first?.y);
      expect(second?.height).toBe(first?.height);
      expect((header?.width ?? 0) - span).toBeLessThanOrEqual(64);
    } else {
      // On a phone the cards stack, each across the width less the page padding.
      expect(second?.y ?? 0).toBeGreaterThan(first?.y ?? 0);
      expect((header?.width ?? 0) - (first?.width ?? 0)).toBeLessThanOrEqual(
        64
      );
    }
    await context.close();
  });
}
