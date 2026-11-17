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

/**
 * A browser may break a line between an inline formula and the full stop after
 * it, so a line would start with the full stop alone. Every inline formula of
 * a lesson that text touches stands in one unit with that text, a unit that
 * takes no line break, and the touching text's first character sits on the
 * line of the formula's last piece at every phone width.
 */
test("a lesson's inline formula keeps the punctuation that touches it on its line", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(pinnedRoutes.inverse.en);
  await expect(page.locator("article .math-inline").first()).toBeVisible();

  for (const width of [320, 360, 390, 414]) {
    await page.setViewportSize({ height: 844, width });
    const facts = await page.evaluate(() => {
      // The lesson's own prose, which its renderer draws: a visual card's
      // parts are drawn by their components.
      const touched = [
        ...document.querySelectorAll("article .math-inline"),
      ].filter((formula) => {
        const next = formula.nextSibling;
        const first = (next?.textContent ?? "").charAt(0);
        return (
          formula.closest('[data-slot="visual-card"], [data-slot="card"]') ===
            null &&
          next?.nodeType === Node.TEXT_NODE &&
          first.trim() !== ""
        );
      });
      const apart = touched.filter((formula) => {
        const unit = formula.parentElement;
        const text = formula.nextSibling;
        const pieces = formula.querySelectorAll(".katex-html > .katex-base");
        const last = pieces.item(pieces.length - 1);
        if (!(unit && text && last)) {
          return true;
        }
        const range = document.createRange();
        range.setStart(text, 0);
        range.setEnd(text, 1);
        const mark = range.getBoundingClientRect();
        const piece = last.getBoundingClientRect();
        const middle = (mark.top + mark.bottom) / 2;
        return (
          getComputedStyle(unit).whiteSpace !== "nowrap" ||
          middle < piece.top ||
          middle > piece.bottom
        );
      });
      return {
        apart: apart.map(
          (formula) =>
            `${formula.textContent?.slice(-12)}|${formula.nextSibling?.textContent?.slice(0, 3)}`
        ),
        touched: touched.length,
      };
    });

    expect(facts.touched).toBeGreaterThan(0);
    expect(facts.apart).toEqual([]);
  }
});
