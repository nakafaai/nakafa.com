import { expect, type Page, test } from "@playwright/test";
import { NINA_MESSAGES_PAGE_SIZE } from "@repo/backend/client/nina/presentation";
import { Array as Arr, Duration, Effect } from "effect";
import { runOnPage } from "../support/chat";
import { answerTurn, chatOf } from "../support/prose";
import { TRANSCRIPT_ROW } from "../support/selector";
import { openServedChat } from "../support/serve";
import { readinessTimeoutMilliseconds } from "../support/timeout";

/**
 * Answers more than two pages of turns hold, so the third page of turns is the
 * one the oldest messages need. The messages page holds `NINA_MESSAGES_PAGE_SIZE`
 * messages, two of them for each answer.
 */
const ANSWERS = 2 * NINA_MESSAGES_PAGE_SIZE + 30;
const CHAT = Arr.makeBy(ANSWERS, (index) =>
  answerTurn({ markdown: `Jawaban ${index + 1}`, order: index + 1 })
);

/**
 * The rows of the served messages, whose keys start with `prose-`. The transcript
 * also shows a row of its own while the turn the chat started with waits for an
 * answer, and the local backend cannot give one, so that row is no message.
 */
const MESSAGE_ROW = `${TRANSCRIPT_ROW}[data-message-id^="prose-"]`;

/** The footer of each row of Nina's answers, whose keys end with `-1`. */
const ANSWER_FOOTER = `${TRANSCRIPT_ROW}[data-message-id$="-1"] [data-slot="message-footer"]`;

/** Scrolls the oldest loaded row into view, which asks Agent for the older page when there is one. */
const reachOldest = (page: Page) =>
  page.locator(MESSAGE_ROW).first().scrollIntoViewIfNeeded();

test.describe("An older page of a chat", () => {
  test.describe.configure({ timeout: 240_000 });

  test("asks for no older messages while their turns load, and gives every answer its footer once they arrive", async ({
    baseURL,
    page,
  }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const served = yield* openServedChat(page, origin, chatOf(CHAT));
        yield* Effect.promise(async () => {
          // The newest answers show their footers once their turns are there.
          await expect(page.locator(ANSWER_FOOTER)).toHaveCount(
            NINA_MESSAGES_PAGE_SIZE / 2,
            { timeout: readinessTimeoutMilliseconds }
          );
        });

        // The next page of messages arrives, but the page of turns that comes
        // with it does not, so the transcript must not ask for another page.
        served.hold();
        yield* Effect.promise(() =>
          expect
            .poll(
              async () => {
                await reachOldest(page);
                return page.locator(MESSAGE_ROW).count();
              },
              { timeout: readinessTimeoutMilliseconds }
            )
            .toBe(2 * NINA_MESSAGES_PAGE_SIZE)
        );
        for (let check = 0; check < 5; check += 1) {
          yield* Effect.sleep(Duration.millis(400));
          yield* Effect.promise(async () => {
            await reachOldest(page);
            expect(await page.locator(MESSAGE_ROW).count()).toBe(
              2 * NINA_MESSAGES_PAGE_SIZE
            );
          });
        }

        // Once the turns arrive, every older page loads, and each answer shows
        // the footer of its settled turn.
        served.release();
        yield* Effect.promise(() =>
          expect
            .poll(
              async () => {
                await reachOldest(page);
                return page.locator(MESSAGE_ROW).count();
              },
              { timeout: readinessTimeoutMilliseconds }
            )
            .toBe(2 * ANSWERS)
        );
        yield* Effect.promise(() =>
          expect(page.locator(ANSWER_FOOTER)).toHaveCount(ANSWERS, {
            timeout: readinessTimeoutMilliseconds,
          })
        );
      })
    );
  });
});
