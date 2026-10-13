import { expect, test } from "@playwright/test";
import { cutText, lines, overflow } from "@/e2e/support/transcript/measure";
import { onChat } from "@/e2e/support/transcript/open";
import {
  LIMIT_SITES,
  limited,
  limitedLoading,
  PUNYCODE_SITE,
  SITE_LONG_LABEL,
  sameHost,
} from "@/e2e/support/transcript/web";

/** The sites of a search, under its query: one box for each card that was limited. */
const SITES = '[data-slot="web-search-sites"]';

/** The hostnames inside one box of sites. */
const HOSTS = ":scope > span";

test.describe("Nina web search sites on a phone", () => {
  test.use({ viewport: { height: 2600, width: 320 } });

  test(
    "names the sites of a finished search and of a failed one, and wraps each hostname instead of cutting it",
    onChat(limited, { locale: "id" }, async (page) => {
      const boxes = page.locator(SITES);
      const done = boxes.nth(0);
      const failed = boxes.nth(1);
      const edge = page.viewportSize()?.width ?? 0;

      // Each card that was limited names its sites, in the order they were
      // given and as the contract holds them: a punycode name stays punycode,
      // and a site that the failed card holds twice shows once.
      await expect(boxes).toHaveCount(2);
      await expect(done.locator(HOSTS)).toHaveText(LIMIT_SITES);
      await expect(failed.locator(HOSTS)).toHaveText([
        SITE_LONG_LABEL,
        PUNYCODE_SITE,
      ]);
      for (const box of [done, failed]) {
        expect(await cutText(box)).toEqual([]);
        // A hostname lies within the page from its first character to its last.
        for (const host of await box.locator(HOSTS).all()) {
          const place = await host.boundingBox();
          expect((place?.x ?? 0) + (place?.width ?? 0)).toBeLessThanOrEqual(
            edge
          );
        }
      }
      // The third hostname is longer than a line, so it takes more than one.
      expect(await lines(done.locator(HOSTS).nth(2))).toBeGreaterThan(1);
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "names the sites of a search that still runs",
    onChat(limitedLoading, { locale: "de", running: true }, async (page) => {
      const boxes = page.locator(SITES);

      await expect(boxes).toHaveCount(1);
      await expect(boxes.locator(HOSTS)).toHaveText(LIMIT_SITES);
      expect(await cutText(boxes)).toEqual([]);
      expect(await overflow(page)).toBe(0);
    })
  );

  test(
    "names no site for a search that was open",
    onChat(sameHost, { locale: "id" }, async (page) => {
      // The query of the card shows, and no site stands under it.
      await expect(page.getByText('"turunan fungsi"')).toBeVisible();
      await expect(page.locator(SITES)).toHaveCount(0);
    })
  );
});
