import { expect, type Page, test } from "@playwright/test";
import { Effect, Record as Rec, Struct } from "effect";
import { runOnPage } from "../support/chat";
import { LEARNER_TEXT, learnerMessage } from "../support/prose";
import type { StoredMessage } from "../support/query";
import { BUBBLE_CONTENT, MARKDOWN_MARKUP } from "../support/selector";
import { bubbleOf, openServedChat, rowOf } from "../support/serve";

/** What learners wrote, one message of each, in the order the page shows them. */
const WORDS = {
  one: learnerMessage({ order: 1, text: LEARNER_TEXT.one }),
  angle: learnerMessage({ order: 2, text: LEARNER_TEXT.angle }),
  relation: learnerMessage({ order: 3, text: LEARNER_TEXT.relation }),
  product: learnerMessage({ order: 4, text: LEARNER_TEXT.product }),
  ampersand: learnerMessage({ order: 5, text: LEARNER_TEXT.ampersand }),
  choices: learnerMessage({ order: 6, text: LEARNER_TEXT.choices }),
  indented: learnerMessage({ order: 7, text: LEARNER_TEXT.indented }),
  arabic: learnerMessage({ order: 8, text: LEARNER_TEXT.arabic }),
  arabicSentence: learnerMessage({
    order: 9,
    text: LEARNER_TEXT.arabicSentence,
  }),
  corners: learnerMessage({ order: 10, text: LEARNER_TEXT.corners }),
  link: learnerMessage({ order: 11, text: LEARNER_TEXT.link }),
};

/**
 * The text the bubble of one message shows, as a reader sees it, with its line
 * breaks and spaces. The row is scrolled to and drawn in the same call that
 * reads it: the transcript can scroll while the page settles, and a row out of
 * sight has no `innerText`.
 */
const shownText = (page: Page, message: StoredMessage) =>
  rowOf(page, message).evaluate(async (row, slot) => {
    row.scrollIntoView({ block: "center" });
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const bubble = row.querySelector(slot);
    return bubble instanceof HTMLElement ? bubble.innerText : "";
  }, BUBBLE_CONTENT);

/**
 * A learner's words are Markdown, and plain words stay as written: text that
 * reads as HTML, asterisks inside a product and each line break keep their
 * place, with no markup around them. A link they paste becomes a link, and
 * lines they indent become a code block, as Markdown draws them.
 */
const showsAsWritten = async (page: Page) => {
  for (const message of Rec.values(Struct.omit(WORDS, ["indented", "link"]))) {
    await expect.soft
      .poll(() => shownText(page, message), message.text)
      .toBe(message.text);
    await expect
      .soft((await bubbleOf(page, message)).locator(MARKDOWN_MARKUP))
      .toHaveCount(0);
  }
  await expect.soft
    .poll(() => shownText(page, WORDS.link), WORDS.link.text)
    .toBe(WORDS.link.text);
  await expect
    .soft((await bubbleOf(page, WORDS.link)).getByRole("link"))
    .toHaveCount(1);
  const indented = (await bubbleOf(page, WORDS.indented)).locator("pre");
  await expect.soft(indented).toHaveCount(1);
  await expect.soft(indented).toContainText("A. 2");
  await expect.soft(indented).toContainText("B. 3");

  // A message of one word is one line tall, as it was: its box adds nothing around its text.
  const one = await (await bubbleOf(page, WORDS.one)).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      around:
        Number.parseFloat(style.borderTopWidth) +
        Number.parseFloat(style.borderBottomWidth) +
        Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom),
      height: element.getBoundingClientRect().height,
      line: Number.parseFloat(style.lineHeight),
    };
  });

  expect.soft(one.height).toBeCloseTo(one.line + one.around, 1);
};

/** One option on each of three lines, not one run-on line. */
const keepsLineBreaks = async (page: Page) => {
  const bubble = await bubbleOf(page, WORDS.choices);
  // Each line of the text is a box of its own, counted when its top changes.
  const lines = await bubble.evaluate((element) => {
    let count = 0;
    let top = Number.NaN;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (Math.round(rect.top) !== top) {
          count += 1;
          top = Math.round(rect.top);
        }
      }
    }
    return count;
  });

  expect.soft(lines).toBe(3);
};

/**
 * No line of a long string stands past the sides of the bubble's content box.
 * The box that holds the words clips what runs past it, and the clipped text
 * is still in the page, so what a bubble scrolls or says cannot tell a string
 * that wrapped from one that was cut: the test reads where each line stands.
 */
const breaksLongStrings = async (page: Page) => {
  const bubble = await bubbleOf(page, WORDS.link);
  const past = await bubble.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const start =
      box.left +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.paddingLeft);
    const end =
      box.right -
      Number.parseFloat(style.borderRightWidth) -
      Number.parseFloat(style.paddingRight);
    let furthest = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        furthest = Math.max(furthest, rect.right - end, start - rect.left);
      }
    }
    return furthest;
  });

  expect.soft(past).toBeLessThanOrEqual(0.5);
};

/** Where an Arabic sentence stands: it reads from the right, and its full stop ends it on the left. */
const takesItsOwnDirection = async (page: Page) => {
  const directionOf = async (message: StoredMessage) =>
    (await bubbleOf(page, message)).evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const first = walker.nextNode();
      let last = first;
      for (let next = walker.nextNode(); next; next = walker.nextNode()) {
        last = next;
      }
      const edge = (node: Node | null, offset: number) => {
        const range = document.createRange();
        range.setStart(node ?? element, offset);
        range.setEnd(node ?? element, offset + 1);
        return range.getBoundingClientRect();
      };
      // The element that carries the words' direction, if the page names one.
      const holder = element.querySelector("[dir]") ?? element;
      return {
        direction: getComputedStyle(holder).direction,
        // Where the first and the last character stand, left to right.
        firstLeft: edge(first, 0).left,
        lastLeft: edge(last, (last?.textContent?.length ?? 1) - 1).left,
      };
    });
  const english = await directionOf(WORDS.angle);
  const arabic = await directionOf(WORDS.arabicSentence);

  expect.soft(english.direction).toBe("ltr");
  expect.soft(english.lastLeft).toBeGreaterThan(english.firstLeft);
  expect.soft(arabic.direction).toBe("rtl");
  expect.soft(arabic.lastLeft).toBeLessThan(arabic.firstLeft);
};

test.describe("A learner's words", () => {
  test.describe.configure({ timeout: 240_000 });

  test("at 320px show as written, wrap and face their own way", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 320 });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openServedChat(page, origin, Rec.values(WORDS));
        yield* Effect.promise(async () => {
          await test.step("show as the learner wrote them", () =>
            showsAsWritten(page));
          await test.step("keep their line breaks", () =>
            keepsLineBreaks(page));
          await test.step("break a long unbroken string", () =>
            breaksLongStrings(page));
          await test.step("take the direction of their own content", () =>
            takesItsOwnDirection(page));
        });
      })
    );
  });
});
