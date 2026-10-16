import { expect, type Page, test } from "@playwright/test";
import { NINA_FILE_COUNT } from "@repo/backend/client/nina/uploads";
import { Array as Arr, Duration, Effect, Order } from "effect";
import {
  chipsIn,
  composerOf,
  photo,
  pickFiles,
  write,
} from "@/e2e/support/attachment";
import { openChatPage, runOnPage, START } from "@/e2e/support/chat";
import {
  inTheSheet,
  openFromHistory,
  openSheet,
  promptWith,
  UNAVAILABLE,
  UNCONFIRMED,
} from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { SAVE, uploadsNamedBy, uploadsReleasedBy } from "@/e2e/support/upload";

const FIRST = { prompt: "What is a limit?", title: "About limits" };
const SECOND = { prompt: "What is a derivative?", title: "About derivatives" };
/** The words the learner sends to the first chat, which the server refuses. */
const FOLLOW_UP = "And the limit of a sum?";
/**
 * How long the upload quota takes to give one place back: it allows
 * `NINA_FILE_COUNT` uploads in a minute (the quota in
 * confect/nina/uploads.impl.ts), and the test has used them all.
 */
const PLACE_BACK_MILLISECONDS =
  Duration.toMillis(Duration.minutes(1)) / NINA_FILE_COUNT;

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

/**
 * The learner attaches as many files as a message holds in one chat of the
 * sheet, and the server refuses the message once they have uploaded. They open
 * another chat, which leaves those files behind while the server still holds a
 * place for each. A message with one more file does not fit beside them, so the
 * page gives those places back first and the file uploads, instead of the
 * learner meeting a limit on files that no composer shows.
 */
const givesBackTheUploadsOfAChatItLeft = Effect.fn(
  "NakafaE2E.sheetGivesBackUploads"
)(function* (page: Page, baseURL: string) {
  const { changes, learner } = yield* openChatPage(page, baseURL);
  yield* learner.startChat(FIRST.prompt);
  yield* learner.startChat(SECOND.prompt);
  yield* learner.titleNewest([SECOND.title, FIRST.title]);
  const sheet = inTheSheet(page);

  yield* openSheet(page);
  yield* openFromHistory(page, FIRST.title);
  yield* opened(page, FIRST.prompt);
  yield* pickFiles(
    sheet,
    Arr.makeBy(NINA_FILE_COUNT, (index) => photo(`photo-${index + 1}.png`))
  );
  yield* write(sheet, FOLLOW_UP);
  changes.failNext(START);
  yield* Effect.promise(async () => {
    await composerOf(sheet).press("Enter");
    await expect(sheet.getByText(UNCONFIRMED)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(chipsIn(sheet)).toHaveCount(NINA_FILE_COUNT);
  });
  const [held] = yield* uploadsNamedBy(changes);

  // The other chat has a composer of its own, and the files are not in it.
  yield* openFromHistory(page, SECOND.title);
  yield* Effect.promise(async () => {
    await expect(promptWith(sheet, SECOND.prompt)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(chipsIn(sheet)).toHaveCount(0);
    await page.waitForTimeout(PLACE_BACK_MILLISECONDS);
  });
  yield* pickFiles(sheet, [photo("late.png")]);
  yield* write(sheet, FOLLOW_UP);
  changes.failNext(START);
  yield* Effect.promise(async () => {
    await composerOf(sheet).press("Enter");
    // The server is asked for the message, and refuses it, only after the
    // file has uploaded: no limit stopped the upload.
    await expect(sheet.getByText(UNCONFIRMED)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  });
  const [, sent] = yield* uploadsNamedBy(changes);
  const released = yield* uploadsReleasedBy(changes);

  yield* Effect.sync(() => {
    expect(changes.argumentsOf(SAVE)).toHaveLength(NINA_FILE_COUNT + 1);
    // The places given back are the ones the first message held, all of them,
    // and the second message names the upload of its own file alone.
    expect(Arr.sort(released, Order.String)).toEqual(
      Arr.sort(held ?? [], Order.String)
    );
    expect(sent).toHaveLength(1);
    expect(Arr.intersection(held ?? [], sent ?? [])).toEqual([]);
  });
});

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

  test("the uploads of a chat the learner left go back when the next message needs the room", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      givesBackTheUploadsOfAChatItLeft(page, origin)
    );
  });
});
