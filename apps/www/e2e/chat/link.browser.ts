import { expect, type Page, test } from "@playwright/test";
import { AuthFailure, AuthReadError } from "@repo/backend/confect/auth/spec";
import { ChatShareReadError } from "@repo/backend/confect/chats/access/spec";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect, Schema } from "effect";
import { ANSWER_MILLISECONDS } from "@/e2e/support/changes";
import { openChatPage, runOnPage, SHARE_TOKEN_QUERY } from "@/e2e/support/chat";
import { withReader } from "@/e2e/support/reader";
import {
  notAvailable,
  offersNoWriting,
  openShareDialog,
  ownedChat,
  promptOf,
  readLink,
  readsChat,
  SHARE_TOKEN,
} from "@/e2e/support/share";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { SHARE_ENTRY } from "@/lib/share/fragment";

const PROMPT = "What is the limit of one over x?";
const TITLE = "The limit of one over x";
/** What the share dialog says when it could not load the link. */
const NOT_LOADED = "We could not load the link";

/**
 * What the server throws, as the page decodes it, when it cannot read the
 * account behind the query: one of the failures the query declares.
 */
const unreadable = Schema.encodeSync(AuthFailure)(
  new AuthReadError({
    code: "AUTH_READ_FAILED",
    message: "Unable to read authentication state.",
  })
);

/**
 * What the server throws, as the page decodes it, when it cannot read or open
 * the share of the chat: the other failure the query declares.
 */
const unopenable = Schema.encodeSync(ChatShareReadError)(
  new ChatShareReadError()
);

/**
 * The owner's share dialog says the link could not load while the query fails
 * with `failure`, and loads it on Retry once the server answers again.
 */
const retriesTheLink = Effect.fn("NakafaE2E.retriesTheLink")(function* (
  page: Page,
  origin: string,
  failure: unknown
) {
  const owner = yield* ownedChat(page, origin, {
    prompt: PROMPT,
    title: TITLE,
  });

  yield* Effect.promise(async () => {
    const dialog = await openShareDialog(page);
    const copy = dialog.getByRole("button", { name: "Copy link" });
    await dialog.evaluate((node) => Reflect.set(node, "shareDialogKept", true));

    // The server fails to answer the query for the token of the link.
    owner.changes.failQuery(SHARE_TOKEN_QUERY, failure);
    await dialog.getByRole("button", { name: "Create link" }).click();

    // The dialog says so and offers to try again, and the chat stays.
    await expect(dialog.getByText(NOT_LOADED)).toBeVisible({
      timeout: ANSWER_MILLISECONDS,
    });
    await expect(copy).toHaveCount(0);
    await expect(promptOf(page, PROMPT)).toBeVisible();
    await expect(notAvailable(page)).toHaveCount(0);

    // The server recovers, the retry loads the link, and the owner copies it.
    owner.changes.recoverQuery();
    await dialog.getByRole("button", { name: en.Ai.retry }).click();
    await expect(copy).toBeEnabled({ timeout: ANSWER_MILLISECONDS });
    // The failure and the retry changed what the dialog says, never the dialog.
    expect(
      await dialog.evaluate((node) => Reflect.get(node, "shareDialogKept"))
    ).toBe(true);
    await copy.click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(readLink(link).token).toMatch(SHARE_TOKEN);
  });
});

test.describe("A share link at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("a reader who opened the address of a chat reads it when the link arrives, in the same page", async ({
    baseURL,
    browser,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { learner } = yield* openChatPage(page, origin);
        const chat = yield* learner.startChat(PROMPT);
        yield* learner.titleNewest([TITLE]);
        const token = yield* learner.share(chat.chatId);
        yield* Effect.sync(() => expect(token).toMatch(SHARE_TOKEN));

        yield* withReader(browser, origin, (reader) =>
          Effect.promise(async () => {
            const address = `/en/chat/${chat.chatId}`;

            // The address alone opens nothing.
            await reader.goto(address);
            await expect(notAvailable(reader)).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await reader.evaluate(() => Reflect.set(window, "kept", true));

            // Adding the link to the address moves within the page, which does
            // not load again, and the page reads the chat.
            await reader.goto(`${address}#${SHARE_ENTRY}=${token}`);
            await readsChat(reader, TITLE, PROMPT);
            await offersNoWriting(reader);
            expect(
              await reader.evaluate(() => Reflect.get(window, "kept"))
            ).toBe(true);
          })
        );
      })
    );
  });

  test("the share dialog says when it could not load the link, and loads it again on Retry", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      retriesTheLink(page, origin, unreadable)
    );
  });

  test("the share dialog says when the server cannot open the link, and loads it again on Retry", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      retriesTheLink(page, origin, unopenable)
    );
  });
});
