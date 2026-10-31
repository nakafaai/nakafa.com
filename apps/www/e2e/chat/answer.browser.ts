import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import {
  ANSWER,
  answerTurn,
  chatOf,
  GERMAN_SUGGESTIONS,
} from "@/e2e/support/prose";
import { drawnRow, openServedChat } from "@/e2e/support/serve";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Answers with a code block, a long link, a list four levels deep and a wide table. */
const CODE = answerTurn({ markdown: ANSWER.code, order: 1 });
const LINK = answerTurn({ markdown: ANSWER.link, order: 2 });
// The follow-up questions a model writes come under its last answer.
const NESTED = answerTurn({
  markdown: ANSWER.nested,
  order: 3,
  suggestions: GERMAN_SUGGESTIONS,
});
const TABLE = answerTurn({ markdown: ANSWER.table, order: 4 });

/** How far each element that matches `selector` ends past the right edge of the row, and how many match. */
const reachBeyond = (row: Locator, selector: string) =>
  row.evaluate((element, query) => {
    const edge = element.getBoundingClientRect().right;
    const past = Array.from(
      element.querySelectorAll(query),
      (node) => node.getBoundingClientRect().right - edge
    );

    return { found: past.length, furthest: Math.max(...past) };
  }, selector);

/** The header of a code block holds a language of eighteen characters and both controls. */
const keepsCodeControlsInside = async (page: Page) => {
  const code = await drawnRow(page, CODE.answer);

  // The controls come with the code, which loads a moment after the block shows.
  await expect(code.locator("[data-code-block-header] button")).toHaveCount(2, {
    timeout: readinessTimeoutMilliseconds,
  });
  const facts = await code.evaluate((row) => {
    const block = row.querySelector("[data-code-block-container]");
    const edge = block?.getBoundingClientRect().right ?? 0;
    const buttons = Array.from(
      row.querySelectorAll("[data-code-block-header] button"),
      (button) => button.getBoundingClientRect()
    );
    const tag = row.querySelector("[data-code-block-header] span[title]");

    return {
      buttons: buttons.map((button) => ({
        left: button.left,
        past: button.right - edge,
      })),
      tag: tag
        ? {
            cut: tag.scrollWidth > tag.clientWidth,
            past: tag.getBoundingClientRect().right - edge,
            right: tag.getBoundingClientRect().right,
          }
        : null,
    };
  });

  expect.soft(facts.buttons).toHaveLength(2);
  for (const button of facts.buttons) {
    expect.soft(button.past).toBeLessThanOrEqual(0.5);
    // The language ends before the first control starts, so nothing overlaps.
    expect.soft(facts.tag?.right).toBeLessThanOrEqual(button.left + 0.5);
  }
  // The language is cut with an ellipsis where it would run into the controls.
  expect.soft(facts.tag?.cut).toBe(true);
  expect.soft(facts.tag?.past).toBeLessThanOrEqual(0.5);
};

/** A long link, four levels of list and a wide table stay in the column, the table inside a box that scrolls it. */
const keepsLongContentInTheColumn = async (page: Page) => {
  const anchor = await reachBeyond(
    await drawnRow(page, LINK.answer),
    'a[data-nakafa="anchor"]'
  );
  const items = await reachBeyond(
    await drawnRow(page, NESTED.answer),
    '[data-nakafa="list-item"]'
  );
  const wide = await (await drawnRow(page, TABLE.answer)).evaluate((row) => {
    // The table scrolls in its container's viewport, under an overlay bar.
    const box = row.querySelector(
      '[data-slot="table-container"] > [data-slot="scroll-area-viewport"]'
    );
    return {
      scrolls: (box?.scrollWidth ?? 0) > (box?.clientWidth ?? 0),
      wider: (box?.scrollWidth ?? 0) > row.clientWidth,
    };
  });
  // The follow-up questions of an answer are full-width buttons, and German ones are long.
  const suggestions = await (await drawnRow(page, NESTED.answer)).evaluate(
    (row, texts: string[]) => {
      const edge = row.getBoundingClientRect().right;
      return Array.from(row.querySelectorAll("button"))
        .filter((button) => texts.includes(button.textContent?.trim() ?? ""))
        .map((button) => button.getBoundingClientRect().right - edge);
    },
    GERMAN_SUGGESTIONS
  );

  expect.soft(anchor.found).toBe(1);
  expect.soft(anchor.furthest).toBeLessThanOrEqual(0.5);
  // One item for each of the four levels.
  expect.soft(items.found).toBe(4);
  expect.soft(items.furthest).toBeLessThanOrEqual(0.5);
  expect.soft(wide).toEqual({ scrolls: true, wider: true });
  expect.soft(suggestions).toHaveLength(GERMAN_SUGGESTIONS.length);
  for (const past of suggestions) {
    expect.soft(past).toBeLessThanOrEqual(0.5);
  }
};

test.describe("Nina's answer", () => {
  test.describe.configure({ timeout: 240_000 });

  test("at 320px keeps code, links, lists and tables in place", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 320 });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openServedChat(
          page,
          origin,
          chatOf([CODE, LINK, NESTED, TABLE])
        );
        yield* Effect.promise(async () => {
          await test.step("keep the controls of a code block inside it", () =>
            keepsCodeControlsInside(page));
          await test.step("keep long content in the column", () =>
            keepsLongContentInTheColumn(page));
        });
      })
    );
  });
});
