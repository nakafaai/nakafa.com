import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { openChatPage, runOnPage, START } from "@/e2e/support/chat";
import {
  composerOf,
  inTheSheet,
  openFromHistory,
  openSheet,
  promptWith,
  UNAVAILABLE,
  UNCONFIRMED,
} from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const FIRST = { prompt: "What is a limit?", title: "About limits" };
const SECOND = { prompt: "What is a derivative?", title: "About derivatives" };
/** The words the learner sends to the first chat, which the server refuses. */
const FOLLOW_UP = "And the limit of a sum?";

/**
 * Waits until the sheet has loaded the chat that holds `prompt`: the prompt
 * shows, and so does the answer that failed, which the local backend cannot
 * avoid. From then on the chat takes a new message.
 */
const opened = (page: Page, prompt: string) =>
  Effect.promise(async () => {
    const sheet = inTheSheet(page);

    await expect(promptWith(sheet, prompt)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(sheet.getByText(UNAVAILABLE)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  });

/**
 * The learner sends a message in one chat of Nina's sheet and the server
 * refuses it, so that chat tells them so. They then open another chat from
 * the history. Nothing of the first chat comes with them: not its refusal,
 * which belongs to its message and not to the sheet.
 */
const leavesTheRefusalBehind = Effect.fn("NakafaE2E.sheetSwitchesChats")(
  function* (page: Page, baseURL: string) {
    const { changes, learner } = yield* openChatPage(page, baseURL);
    yield* learner.startChat(FIRST.prompt);
    yield* learner.startChat(SECOND.prompt);
    yield* learner.titleNewest([SECOND.title, FIRST.title]);

    yield* openSheet(page);
    yield* openFromHistory(page, FIRST.title);
    yield* opened(page, FIRST.prompt);
    yield* Effect.promise(async () => {
      const sheet = inTheSheet(page);

      await composerOf(sheet).fill(FOLLOW_UP);
      await expect(
        sheet.getByRole("button", { name: "Send message" })
      ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
      changes.failNext(START);
      await composerOf(sheet).press("Enter");
      await expect(sheet.getByText(UNCONFIRMED)).toBeVisible();
    });

    yield* openFromHistory(page, SECOND.title);
    yield* Effect.promise(async () => {
      const sheet = inTheSheet(page);

      await expect(promptWith(sheet, SECOND.prompt)).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      // The refusal is not there when the chat shows, and it does not come
      // after: the chat tells of its own failed answer, and of nothing else.
      await expect(sheet.getByText(UNCONFIRMED)).toHaveCount(0);
      await expect(sheet.getByText(UNAVAILABLE)).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await expect(sheet.getByText(UNCONFIRMED)).toHaveCount(0);
    });
  }
);

test.describe("Chats in the sheet at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("a refusal stays in the chat it happened in when the learner opens another", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      leavesTheRefusalBehind(page, origin)
    );
  });
});
