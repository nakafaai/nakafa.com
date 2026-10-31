import { expect, test } from "@playwright/test";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const HOME = "/en";
/** How far each step of the walk down the page scrolls, in pixels. */
const SCROLL_STEP = 900;
/** The window list that holds every section the page's HTML drew, before any script ran. */
const DRAWN = "nakafaDrawnSections";

/**
 * The home page hydrates each section after the hero in a boundary of its own,
 * once the reader nears it. Every section the static HTML drew stays the same
 * element once the page has come alive: React hydrated it in place and never
 * threw its markup away to draw it again, which would flash and shift the page.
 */
test("hydrates every home section in place, section by section", async ({
  page,
}) => {
  await page.addInitScript((mark: string) => {
    document.addEventListener("DOMContentLoaded", () => {
      Reflect.set(
        window,
        mark,
        Array.from(document.querySelectorAll("main section"))
      );
    });
  }, DRAWN);

  await page.goto(HOME);
  // A hydrated link runs the router: walk down the page, and wait for the last section's links.
  await expect
    .poll(
      async () => {
        await page.mouse.wheel(0, SCROLL_STEP);
        return page.evaluate(() =>
          Array.from(document.querySelectorAll("main section a")).every(
            (link) =>
              Object.keys(link).some((key) => key.startsWith("__reactProps$"))
          )
        );
      },
      { timeout: readinessTimeoutMilliseconds }
    )
    .toBe(true);

  const drawn = await page.evaluate((mark) => {
    const sections: Element[] = Reflect.get(window, mark) ?? [];
    return {
      connected: sections.filter((section) => section.isConnected).length,
      total: sections.length,
    };
  }, DRAWN);

  expect(drawn.total).toBeGreaterThan(5);
  expect(drawn.connected).toBe(drawn.total);
});
