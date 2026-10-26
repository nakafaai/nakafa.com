import { expect, test } from "@playwright/test";
import { pinnedRoutes } from "@/e2e/support/corpus";

/**
 * A lesson draws dozens of display formulas, each in a card that scrolls a
 * wide formula sideways in its own box, as code blocks do. The card is plain
 * markup: no scroll area component hydrates, measures or draws scrollbars for
 * it, and the page itself never scrolls sideways on a phone.
 */
test("a lesson's display formulas scroll in plain boxes, and the page stays still sideways", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(pinnedRoutes.inverse.en);
  const blocks = page.locator("[data-math-block]");
  await expect(blocks.first()).toBeVisible();

  const facts = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-math-block]")];
    return {
      areas: cards.filter(
        (card) => card.querySelector('[data-slot^="scroll-area"]') !== null
      ).length,
      cards: cards.length,
      native: cards.filter((card) => {
        const box = card.querySelector('[data-slot="math-scroll"]');
        return box !== null && getComputedStyle(box).overflowX === "auto";
      }).length,
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });

  expect(facts.cards).toBeGreaterThan(0);
  expect(facts.areas).toBe(0);
  expect(facts.native).toBe(facts.cards);
  expect(facts.page).toBeLessThanOrEqual(0);
});
