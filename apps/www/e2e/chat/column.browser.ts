import { expect, type Locator, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { answerMessage, learnerMessage, PASTED } from "@/e2e/support/prose";
import { drawnRow, openServedChat } from "@/e2e/support/serve";

/** A long question and a long answer, so each runs to its measure. */
const QUESTION = learnerMessage({ order: 1, text: PASTED });
const ANSWER = answerMessage({ markdown: PASTED, order: 1 });

/** The widest a message reads at, in pixels: `max-w-3xl`. */
const MEASURE = 768;

/** The column the transcript lays its messages in. */
const COLUMN = '[data-slot="message-scroller-content"]';
/** The box of the composer, under the transcript. */
const COMPOSER = 'form [data-slot="input-group"]';
/** The part of a row that holds its message. */
const CONTENT = '[data-slot="message-content"]';

/** The left and right edges of an element's box, in pixels. */
const edgesOf = (element: Locator) =>
  element.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { left: box.left, right: box.right, width: box.width };
  });

/**
 * The chat page takes the forum's composition. The transcript and the composer
 * share one column as wide as the page allows (`max-w-7xl`), so on a wide
 * screen the composer runs the column's width under the messages. Each message
 * keeps a readable measure: the question at the column's end, and the answer at
 * its start.
 */
test("at 1440px the composer runs the column's width and each message keeps its measure", async ({
  baseURL,
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      yield* openServedChat(page, origin, [QUESTION, ANSWER]);
      yield* Effect.promise(async () => {
        const question = (await drawnRow(page, QUESTION)).locator(CONTENT);
        const answer = (await drawnRow(page, ANSWER)).locator(CONTENT);
        const column = await page
          .locator(COLUMN)
          .first()
          .evaluate((node) => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return {
              left: box.left + Number.parseFloat(style.paddingLeft),
              right: box.right - Number.parseFloat(style.paddingRight),
            };
          });
        const composer = await edgesOf(page.locator(COMPOSER).last());
        const asked = await edgesOf(question.first());
        const answered = await edgesOf(answer.first());

        expect(column.right - column.left).toBeGreaterThan(MEASURE);
        expect(composer.left).toBeCloseTo(column.left, 0);
        expect(composer.right).toBeCloseTo(column.right, 0);
        expect(asked.width).toBeLessThanOrEqual(MEASURE);
        expect(asked.right).toBeCloseTo(column.right, 0);
        expect(answered.width).toBeLessThanOrEqual(MEASURE);
        expect(answered.left).toBeCloseTo(column.left, 0);
      });
    })
  );
});
