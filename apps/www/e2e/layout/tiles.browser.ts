import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { signInLearner } from "@/e2e/support/learner";
import { finishOnboarding } from "@/e2e/support/onboarding";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const HOME = "/en/home";
const QURAN = "/en/quran";
const TILE_WIDTHS = [320, 390, 768, 1024, 1440];
const QURAN_WIDTHS = [390, 768, 1440];
/** The most two sizes or two centers may differ, in pixels. */
const TOLERANCE = 1;
/** The square of each home tile, above its name. */
const TILE = "main a:has(> h2) > div:first-child";

/** The owner saw the four home tiles wide on a phone, so each one is measured square. */
test("every home tile stays square at every width", async ({
  baseURL,
  browser,
}) => {
  const context = await browser.newContext();
  await Effect.runPromise(signInLearner(context, String(baseURL)));
  const page = await context.newPage();
  await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
  await finishOnboarding(page);
  for (const width of TILE_WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    await page.goto(HOME);
    await expect(page.locator(TILE)).toHaveCount(4, {
      timeout: readinessTimeoutMilliseconds,
    });
    const sizes = await page
      .locator(TILE)
      .evaluateAll((tiles) =>
        tiles.map((tile) => tile.getBoundingClientRect())
      );
    for (const { height, width: tileWidth } of sizes) {
      expect(Math.abs(tileWidth - height), `${width}px`).toBeLessThanOrEqual(
        TOLERANCE
      );
    }
  }
  await context.close();
});

/** A surah's number, its title and its Arabic name stand on one line, by their centers. */
for (const width of QURAN_WIDTHS) {
  test(`a surah row centers its number and its two names at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto(QURAN);
    const row = page.locator("main a:has(h2)").first();
    const centers = await row.evaluate((link) => {
      const center = (element: Element | null) => {
        const box = element?.getBoundingClientRect();
        return box === undefined ? -1 : box.top + box.height / 2;
      };
      const name = link.querySelector("h2");
      return [
        center(name?.parentElement?.firstElementChild ?? null),
        center(name?.firstElementChild ?? null),
        center(name?.lastElementChild ?? null),
      ];
    });
    const [number = 0, title = 0, arabic = 0] = centers;
    expect(Math.abs(number - title)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(title - arabic)).toBeLessThanOrEqual(TOLERANCE);
  });
}
