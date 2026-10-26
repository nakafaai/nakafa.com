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

/**
 * Where a formula of the answer stands, found by the TeX it was written in. A
 * piece is one `.katex-base`, and it is its own box: it scrolls sideways when it
 * is wider than the column. Its box is its border less the padding and margin
 * that cancel for layout, so the margin box is what the line sees.
 */
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
    const pieces = Array.from(
      katex.querySelectorAll(".katex-html > .katex-base")
    );
    const marginBox = (piece: Element) => {
      const rect = piece.getBoundingClientRect();
      const style = getComputedStyle(piece);
      return {
        bottom: rect.bottom,
        left: rect.left - Number.parseFloat(style.marginLeft),
        right: rect.right + Number.parseFloat(style.marginRight),
        top: rect.top,
      };
    };
    const widths = pieces.map((piece) => {
      const box = marginBox(piece);
      return box.right - box.left;
    });
    const widestIndex = widths.indexOf(Math.max(...widths));
    const widest = pieces[widestIndex];
    const first = marginBox(pieces[0]);
    const lastPiece = pieces.at(-1);
    if (!lastPiece) {
      return null;
    }
    const last = marginBox(lastPiece);
    const facts = {
      column: column.width,
      inColumn: pieces.every((piece) => {
        const box = marginBox(piece);
        return box.left >= column.left - 0.5 && box.right <= column.right + 0.5;
      }),
      pieces: pieces.length,
      scrolls: widest.scrollWidth > widest.clientWidth,
      total: widths.reduce((sum, width) => sum + width, 0),
      widest: widths[widestIndex],
      // The formula's pieces stand on more than one line when the last one is lower.
      wrapped: last.top > first.top + 1,
    };
    // Scrolled to its end, the last glyph of the widest piece stands inside its box.
    widest.scrollLeft = widest.scrollWidth;
    const walker = document.createTreeWalker(widest, NodeFilter.SHOW_TEXT);
    let glyphs: Node | null = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim()) {
        glyphs = node;
      }
    }
    const range = document.createRange();
    range.selectNodeContents(glyphs ?? widest);
    const visibleRight =
      widest.getBoundingClientRect().left +
      widest.clientLeft +
      widest.clientWidth;
    return {
      ...facts,
      // How far the last glyph stands past the visible end of the widest piece.
      pastEnd: range.getBoundingClientRect().right - visibleRight,
    };
  }, tex);

/**
 * Where the punctuation after a formula stands against the formula's last
 * piece: the gap between them, and whether the comma and the word after it are
 * on the line of that piece.
 */
const punctuationAfter = (row: Locator, tex: string) =>
  row.evaluate((element, source) => {
    const katex = Array.from(element.querySelectorAll(".katex")).find(
      (node) =>
        node.querySelector('annotation[encoding="application/x-tex"]')
          ?.textContent === source
    );
    // The box InlineMath draws around the formula, which marks itself as ignored by Markdown.
    const holder = katex?.closest("[data-markdown-ignore]");
    const after = holder?.nextSibling;
    const pieces = katex
      ? Array.from(katex.querySelectorAll(".katex-html > .katex-base"))
      : [];
    const last = pieces.at(-1);
    if (!(holder && last && after?.nodeType === Node.TEXT_NODE)) {
      return null;
    }
    const rect = last.getBoundingClientRect();
    const edge =
      rect.right + Number.parseFloat(getComputedStyle(last).marginRight);
    const range = document.createRange();
    range.setStart(after, 0);
    range.setEnd(after, 1);
    const comma = range.getBoundingClientRect();
    range.setStart(after, 2);
    range.setEnd(after, 5);
    const word = range.getBoundingClientRect();
    const onLastLine = (box: DOMRect) =>
      box.top < rect.bottom && box.bottom > rect.top;
    return {
      gap: comma.left - edge,
      onLastLine: onLastLine(comma),
      wordOnLastLine: onLastLine(word),
    };
  }, tex);

/**
 * How far below the baseline of the text around it the baseline of a formula
 * stands, in pixels: zero when they share one, negative when the formula
 * stands higher. A box with no size marks each baseline, and both marks leave
 * the page again. The formula's mark sits inside its first glyph's own line, so
 * it reads the line of the glyphs whatever box holds them.
 */
const baselineOffset = (row: Locator, tex: string) =>
  row.evaluate((element, source) => {
    const katex = Array.from(element.querySelectorAll(".katex")).find(
      (node) =>
        node.querySelector('annotation[encoding="application/x-tex"]')
          ?.textContent === source
    );
    const paragraph = katex?.closest("p");
    const html = katex?.querySelector(".katex-html");
    if (!(katex && paragraph && html)) {
      return Number.NaN;
    }
    // The child of the paragraph that holds the formula, whatever wraps it.
    let wrapper: Element = katex;
    while (wrapper.parentElement && wrapper.parentElement !== paragraph) {
      wrapper = wrapper.parentElement;
    }
    const walker = document.createTreeWalker(html, NodeFilter.SHOW_TEXT);
    let glyph = walker.nextNode();
    while (glyph && !glyph.textContent?.trim()) {
      glyph = walker.nextNode();
    }
    if (!glyph?.parentNode) {
      return Number.NaN;
    }
    // A box with no size sits on the baseline of the line it is in.
    const probe = () => {
      const node = document.createElement("i");
      node.style.cssText = "display:inline-block;width:0;height:0";
      return node;
    };
    const inText = paragraph.insertBefore(probe(), wrapper);
    const inFormula = glyph.parentNode.insertBefore(probe(), glyph);
    const offset =
      inFormula.getBoundingClientRect().bottom -
      inText.getBoundingClientRect().bottom;

    inText.remove();
    inFormula.remove();
    return offset;
  }, tex);

/**
 * The formulas of an answer at 320 px: a formula that KaTeX breaks wraps, its
 * pieces stay in the column, and the punctuation after it follows the last
 * piece on its line. A formula that cannot break scrolls inside the column, and
 * a formula that fits keeps the baseline of the text around it.
 */
const placesFormulas = async (page: Page) => {
  const row = await drawnRow(page, FORMULAS.answer);
  const wide = await formulaFacts(row, UNBREAKABLE_TEX);
  const breakable = await formulaFacts(row, BREAKABLE_TEX);
  const punctuation = await punctuationAfter(row, BREAKABLE_TEX);

  // The formula that KaTeX cannot break scrolls in its own box, inside the column.
  expect.soft(wide?.scrolls).toBe(true);
  expect.soft(wide?.inColumn).toBe(true);
  expect.soft(wide?.pastEnd).toBeLessThanOrEqual(1);
  // KaTeX breaks the other after an operator: it wraps, every piece stays in the column, and none scrolls.
  expect.soft(breakable?.total).toBeGreaterThan(breakable?.column ?? 0);
  expect.soft(breakable?.wrapped).toBe(true);
  expect.soft(breakable?.inColumn).toBe(true);
  expect.soft(breakable?.scrolls).toBe(false);
  // The comma after the wrapped formula stands on the line of its last piece, right after it.
  expect.soft(Math.abs(punctuation?.gap ?? Number.NaN)).toBeLessThanOrEqual(1);
  expect.soft(punctuation?.onLastLine).toBe(true);
  expect.soft(punctuation?.wordOnLastLine).toBe(true);
  // A fitting formula keeps the baseline of the text around it.
  expect
    .soft(Math.abs(await baselineOffset(row, FITTING_TEX)))
    .toBeLessThanOrEqual(0.5);
};

/** A display formula scrolls in its own card, and nothing else scrolls sideways. */
const scrollsDisplayFormulas = async (page: Page) => {
  const row = await drawnRow(page, FORMULAS.answer);
  const facts = await row.evaluate((element) => {
    const card = element.querySelector(
      '[data-math-block] [data-slot="math-scroll"]'
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
