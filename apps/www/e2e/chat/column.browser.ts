import { expect, type Locator, test } from "@playwright/test";
import { Effect } from "effect";
import { runOnPage } from "@/e2e/support/chat";
import { answerMessage, learnerMessage, PASTED } from "@/e2e/support/prose";
import { drawnRow, openServedChat } from "@/e2e/support/serve";

/** A long question and a long answer, so each runs to its measure. */
const QUESTION = learnerMessage({ order: 1, text: PASTED });
const ANSWER = answerMessage({ markdown: PASTED, order: 1 });

/** The width of the chat page's header and body, in pixels: `max-w-3xl`. */
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
 * The chat page's body is as wide as its header, `max-w-3xl`: on a wide screen
 * the transcript, its messages and the composer stay inside that measure.
 */
test("at 1440px the transcript and the composer keep the 3xl measure of the header", async ({
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
        const column = await edgesOf(page.locator(COLUMN).first());
        const composer = await edgesOf(page.locator(COMPOSER).last());
        const asked = await edgesOf(question.first());
        const answered = await edgesOf(answer.first());

        expect(column.width).toBeLessThanOrEqual(MEASURE);
        expect(composer.width).toBeLessThanOrEqual(MEASURE);
        expect(asked.left).toBeGreaterThanOrEqual(column.left);
        expect(asked.right).toBeLessThanOrEqual(column.right);
        expect(answered.left).toBeGreaterThanOrEqual(column.left);
        expect(answered.right).toBeLessThanOrEqual(column.right);
      });
    })
  );
});
