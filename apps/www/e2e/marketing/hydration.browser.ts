import { expect, test } from "@playwright/test";

const HOME = "/en";
/** The window list that holds every section the page's HTML drew, before any script ran. */
const DRAWN = "nakafaDrawnSections";

/**
 * The home page hydrates each section after the hero in a boundary of its own.
 * Every section the static HTML drew stays the same element once the page has
 * come alive: React hydrated it in place and never threw its markup away to
 * draw it again, which would flash and shift the page.
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
  // A hydrated link runs the router: wait for the last section's links.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll("main section a")).every((link) =>
          Object.keys(link).some((key) => key.startsWith("__reactProps$"))
        )
      )
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
