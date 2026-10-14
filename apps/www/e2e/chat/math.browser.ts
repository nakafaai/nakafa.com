import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import {
  ANSWER,
  answerTurn,
  BREAKABLE_TEX,
  FITTING_TEX,
  UNBREAKABLE_TEX,
} from "@/e2e/support/prose";
import { drawnRow, openServedChat } from "@/e2e/support/serve";

/** An answer with three inline formulas and a display formula. */
const FORMULAS = answerTurn({ markdown: ANSWER.formulas, order: 1 });

/** Where a formula of the answer stands, found by the TeX it was written in. */
const formulaFacts = (row: Locator, tex: string) =>
  row.evaluate((element, source) => {
    const katex = Array.from(element.querySelectorAll(".katex")).find(
      (node) =>
        node.querySelector('annotation[encoding="application/x-tex"]')
          ?.textContent === source
    );
    if (!katex) {
      return null;
    }
    const column = element.getBoundingClientRect();
    const bases = Array.from(katex.querySelectorAll(".katex-base"));
    const widest = bases.reduce((best, base) =>
      base.getBoundingClientRect().width > best.getBoundingClientRect().width
        ? base
        : best
    );
    // The nearest box above the formula that scrolls sideways, if it has to.
    let box: Element | null = null;
    for (
      let node = widest.parentElement;
      node && node !== element;
      node = node.parentElement
    ) {
      const overflow = getComputedStyle(node).overflowX;
      if (
        (overflow === "auto" || overflow === "scroll") &&
        node.scrollWidth > node.clientWidth
      ) {
        box = node;
        break;
      }
    }
    const before = {
      boxWidth: box ? box.getBoundingClientRect().width : 0,
      column: column.width,
      inColumn: bases.every(
        (base) => base.getBoundingClientRect().right <= column.right + 0.5
      ),
      scrolls: box !== null,
      // The formula side by side in one line, as wide as its pieces together.
      total: bases.reduce(
        (sum, base) => sum + base.getBoundingClientRect().width,
        0
      ),
      widest: widest.getBoundingClientRect().width,
    };
    if (box) {
      box.scrollLeft = box.scrollWidth;
    }
    return {
      ...before,
      // How far the end of the widest piece stands past the box, or the column.
      pastEnd:
        widest.getBoundingClientRect().right -
        (box ?? element).getBoundingClientRect().right,
    };
  }, tex);

/**
 * How far below the baseline of the text around it the baseline of a formula
 * stands, in pixels: zero when they share one, negative when the formula
 * stands higher. A box with no size marks each baseline, and both marks leave
 * the page again.
 */
const baselineOffset = (row: Locator, tex: string) =>
  row.evaluate((element, source) => {
    const katex = Array.from(element.querySelectorAll(".katex")).find(
      (node) =>
        node.querySelector('annotation[encoding="application/x-tex"]')
          ?.textContent === source
    );
    const paragraph = katex?.closest("p");
    const base = katex?.querySelector(".katex-base");
    if (!(katex && paragraph && base)) {
      return Number.NaN;
    }
    // The child of the paragraph that holds the formula, whatever wraps it.
    let wrapper: Element = katex;
    while (wrapper.parentElement && wrapper.parentElement !== paragraph) {
      wrapper = wrapper.parentElement;
    }
    // A box with no size sits on the baseline of the line it is in.
    const probe = () => {
      const node = document.createElement("i");
      node.style.cssText = "display:inline-block;width:0;height:0";
      return node;
    };
    const inText = paragraph.insertBefore(probe(), wrapper);
    const inFormula = base.insertBefore(probe(), base.firstChild);
    const offset =
      inFormula.getBoundingClientRect().bottom -
      inText.getBoundingClientRect().bottom;

    inText.remove();
    inFormula.remove();
    return offset;
  }, tex);

/**
 * A formula wider than the column scrolls in a box no wider than the column. A
 * formula that can break wraps, though it is wider than the column when it is
 * not broken. One that fits keeps the line of the text around it.
 */
const placesFormulas = async (page: Page) => {
  const row = await drawnRow(page, FORMULAS.answer);
  const wide = await formulaFacts(row, UNBREAKABLE_TEX);
  const breakable = await formulaFacts(row, BREAKABLE_TEX);

  expect.soft(wide?.widest).toBeGreaterThan(wide?.column ?? 0);
  expect.soft(wide?.scrolls).toBe(true);
  expect.soft(wide?.boxWidth).toBeLessThanOrEqual(wide?.column ?? 0);
  // Scrolled to its end, the last piece of the formula is inside the box.
  expect.soft(wide?.pastEnd).toBeLessThanOrEqual(1);
  // KaTeX wraps the other after an operator, so every piece is inside the column.
  expect.soft(breakable?.total).toBeGreaterThan(breakable?.column ?? 0);
  expect.soft(breakable?.inColumn).toBe(true);
  expect.soft(breakable?.scrolls).toBe(false);
  expect
    .soft(Math.abs(await baselineOffset(row, FITTING_TEX)))
    .toBeLessThanOrEqual(0.5);
};

/** A display formula scrolls in its own card, and nothing else scrolls sideways. */
const scrollsDisplayFormulas = async (page: Page) => {
  const row = await drawnRow(page, FORMULAS.answer);
  const facts = await row.evaluate((element) => {
    const card = element.querySelector(
      '[data-math-block] [data-slot="scroll-area-viewport"]'
    );
    const transcript = element.closest(
      '[data-slot="message-scroller-viewport"]'
    );
    return {
      card: (card?.scrollWidth ?? 0) - (card?.clientWidth ?? 0),
      page:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      transcript:
        (transcript?.scrollWidth ?? 0) - (transcript?.clientWidth ?? 0),
    };
  });

  expect.soft(facts.card).toBeGreaterThan(0);
  expect.soft(facts.page).toBeLessThanOrEqual(0);
  expect.soft(facts.transcript).toBeLessThanOrEqual(0);
};

test.describe("Formulas in Nina's answer", () => {
  test.describe.configure({ timeout: 240_000 });

  test("at 320px stay in the column", async ({ baseURL, page }) => {
    await page.setViewportSize({ height: 900, width: 320 });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openServedChat(page, origin, [
          FORMULAS.question,
          FORMULAS.answer,
        ]);
        yield* Effect.promise(async () => {
          await test.step("place inline formulas", () => placesFormulas(page));
          await test.step("scroll display formulas in their cards", () =>
            scrollsDisplayFormulas(page));
        });
      })
    );
  });
});
