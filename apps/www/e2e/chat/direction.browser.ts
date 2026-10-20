import { expect, type Locator, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { ANSWER, answerTurn, chatOf } from "@/e2e/support/prose";
import { drawnRow, openServedChat } from "@/e2e/support/serve";

/** An Arabic answer with a paragraph and a tight list, one with a heading and a table, and one with a loose list. */
const STEPS = answerTurn({ markdown: ANSWER.arabic, order: 1 });
const BLOCKS = answerTurn({ markdown: ANSWER.arabicBlocks, order: 2 });
const LOOSE = answerTurn({ markdown: ANSWER.arabicLoose, order: 3 });
/** An answer with a list of three items, of which the second is in Arabic and the others are not. */
const MIXED = answerTurn({ markdown: ANSWER.mixedList, order: 4 });

/**
 * How each block of a row that matches `selector` reads, and where its text
 * stands in it: the direction, the room between the text and each edge of the
 * block, the room the block keeps at each side for its list marker, and where
 * its first and its last character stand.
 */
const standingOf = (row: Locator, selector: string) =>
  row.evaluate(
    (element, query) =>
      Array.from(element.querySelectorAll(query), (block) => {
        const texts: Text[] = [];
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        for (
          let node = walker.nextNode();
          node instanceof Text;
          node = walker.nextNode()
        ) {
          if ((node.textContent ?? "").trim() !== "") {
            texts.push(node);
          }
        }
        // Where one character of a text stands, from the left of the page.
        const characterLeft = (text: Text, offset: number) => {
          const range = document.createRange();
          range.setStart(text, offset);
          range.setEnd(text, offset + 1);
          return range.getBoundingClientRect().left;
        };
        const extents = texts.map((text) => {
          const range = document.createRange();
          range.selectNodeContents(text);
          return range.getBoundingClientRect();
        });
        const firstText = texts.at(0);
        const lastText = texts.at(-1);
        const box = block.getBoundingClientRect();
        const style = getComputedStyle(block);

        return {
          direction: style.direction,
          firstLeft: firstText
            ? characterLeft(
                firstText,
                (firstText.textContent?.length ?? 0) -
                  (firstText.textContent?.trimStart().length ?? 0)
              )
            : Number.NaN,
          lastLeft: lastText
            ? characterLeft(
                lastText,
                (lastText.textContent?.trimEnd().length ?? 1) - 1
              )
            : Number.NaN,
          leftGap: Math.min(...extents.map((rect) => rect.left)) - box.left,
          marginLeft: Number.parseFloat(style.marginLeft),
          marginRight: Number.parseFloat(style.marginRight),
          rightGap: box.right - Math.max(...extents.map((rect) => rect.right)),
        };
      }),
    selector
  );

/** Whether the text of a block starts at its right side: it has less room there than at the left. */
const startsAtRight = (block: { leftGap: number; rightGap: number }) =>
  block.rightGap < block.leftGap;

/** An Arabic paragraph reads from the right, and its full stop ends the line on the left. */
const readsParagraphFromTheRight = async (row: Locator) => {
  const [paragraph] = await standingOf(row, '[data-nakafa="paragraph"]');

  expect.soft(paragraph?.direction).toBe("rtl");
  expect.soft(paragraph ? startsAtRight(paragraph) : false).toBe(true);
  expect.soft(paragraph?.lastLeft).toBeLessThan(paragraph?.firstLeft ?? 0);
};

/** A heading and the cells of a table read from the right, as the words in them do. */
const readsHeadingAndTableFromTheRight = async (row: Locator) => {
  const heading = await standingOf(row, '[data-nakafa="heading-2"]');
  const heads = await standingOf(row, '[data-nakafa="table-head"]');
  const cells = await standingOf(row, '[data-nakafa="table-cell"]');

  expect.soft(heading).toHaveLength(1);
  expect.soft(heads).toHaveLength(2);
  expect.soft(cells).toHaveLength(2);
  for (const block of [...heading, ...heads, ...cells]) {
    expect.soft(block.direction).toBe("rtl");
    expect.soft(startsAtRight(block)).toBe(true);
  }
};

/** The items of a list read from the right and keep the room of their marker there, tight or loose. */
const keepsMarkerRoomAtTheRight = async (row: Locator) => {
  const items = await standingOf(row, '[data-nakafa="list-item"]');

  expect.soft(items).toHaveLength(3);
  for (const item of items) {
    expect.soft(item.direction).toBe("rtl");
    expect.soft(startsAtRight(item)).toBe(true);
    expect.soft(item.marginRight).toBeGreaterThan(0);
    expect.soft(item.marginLeft).toBe(0);
  }
};

/** Each item of a list reads as its own words do: the Arabic one keeps its marker room at the right, the others at the left. */
const readsEachItemItsOwnWay = async (row: Locator) => {
  const items = await standingOf(row, '[data-nakafa="list-item"]');
  const [first, second, third] = items;

  expect.soft(items).toHaveLength(3);
  for (const item of [first, third]) {
    expect.soft(item?.direction).toBe("ltr");
    expect.soft(item?.marginLeft).toBeGreaterThan(0);
    expect.soft(item?.marginRight).toBe(0);
  }
  expect.soft(second?.direction).toBe("rtl");
  expect.soft(second?.marginRight).toBeGreaterThan(0);
  expect.soft(second?.marginLeft).toBe(0);
  // The room is the same at the side where each item keeps it.
  expect.soft(second?.marginRight).toBe(first?.marginLeft);
};

test.describe("The direction of Nina's answer", () => {
  test.describe.configure({ timeout: 240_000 });

  test("at 320px follows the words of each block", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 320 });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openServedChat(
          page,
          origin,
          chatOf([STEPS, BLOCKS, LOOSE, MIXED])
        );
        yield* Effect.promise(async () => {
          await test.step("read a paragraph from the right", async () =>
            readsParagraphFromTheRight(await drawnRow(page, STEPS.answer)));
          await test.step("read a tight list from the right", async () =>
            keepsMarkerRoomAtTheRight(await drawnRow(page, STEPS.answer)));
          await test.step("read a heading and a table from the right", async () =>
            readsHeadingAndTableFromTheRight(
              await drawnRow(page, BLOCKS.answer)
            ));
          await test.step("read a loose list from the right", async () =>
            keepsMarkerRoomAtTheRight(await drawnRow(page, LOOSE.answer)));
          await test.step("read each item of a mixed list its own way", async () =>
            readsEachItemItsOwnWay(await drawnRow(page, MIXED.answer)));
        });
      })
    );
  });
});
