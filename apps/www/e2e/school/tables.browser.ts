import { expect, type Locator, test } from "@playwright/test";
import { Effect } from "effect";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The app's page width, which no table page grows past. */
const PAGE_WIDTH = 1280;
/** The page's gutter around the card of a table page. */
const GUTTER = 16;

/** Reads where the card sits against the viewport and whether the page scrolls sideways. */
function readCard(card: Locator) {
  return card.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      bottom: box.bottom,
      sideways:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      viewport: window.innerHeight,
      width: box.width,
    };
  });
}

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test.describe(`a School table page at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("holds its list in one card that fills the body under the header", async ({
      browser,
      baseURL,
    }) => {
      const school = await Effect.runPromise(createSchool());
      const address = (path: string) =>
        hostAddress(baseURL, `${school.slug}.localhost`, path);
      const context = await browser.newContext({ viewport });
      await Effect.runPromise(signInOwner(context, school.slug, address("/")));
      const page = await context.newPage();

      await page.goto(address("/settings/members"));
      const card = page.locator('[data-slot="table-card"]');
      await expect(card).toHaveCount(1);
      await expect(card.locator("table")).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await expect(card.getByRole("row")).not.toHaveCount(0);

      const placed = await readCard(card);
      expect(placed.sideways).toBe(false);
      expect(placed.width).toBeLessThanOrEqual(PAGE_WIDTH);
      // A short list still fills the body: the card reaches the gutter above the screen's bottom.
      expect(placed.bottom).toBeGreaterThanOrEqual(
        placed.viewport - GUTTER - 1
      );
      await context.close();
    });
  });
}
