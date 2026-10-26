import { type Browser, expect, type Page, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { AI_STORAGE_KEY } from "@/components/ai/store/create";
import { composerOf } from "@/e2e/support/attachment";
import { LESSON_PATH, openChatPage, runOnPage } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  notAvailable,
  promptOf,
  SHARE_TOKEN,
  UNAVAILABLE_COPY,
} from "@/e2e/support/share";
import {
  inTheSheet,
  openFromHistory,
  openSheet,
  promptWith,
} from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const PROMPT = "How do I find the area under a curve?";
const TITLE = "Area under a curve";
const OWN_PROMPT = "What is the slope of a line?";
const OWN_TITLE = "The slope of a line";
/** What the sheet says when it holds no chat, in place of a conversation. */
const NEW_CHAT = "What do you want to learn?";
const VIEWPORT = { height: 900, width: 1440 };

/** What the sheet writes to the browser to remember the chat it has open. */
const Remembered = Schema.fromJsonString(
  Schema.Struct({
    state: Schema.Struct({ activeChatId: Schema.NullOr(Schema.String) }),
  })
);
const decodeRemembered = Schema.decodeSync(Remembered);

/** What the sheet of the page has written to the browser's storage, none before it wrote. */
const storedBySheet = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), AI_STORAGE_KEY);

/** The chat the sheet of the page remembers, none when it remembers none. */
const rememberedChat = async (page: Page) => {
  const stored = await storedBySheet(page);
  return stored === null ? null : decodeRemembered(stored).state.activeChatId;
};

/**
 * Runs `use` for a second learner in a browser of their own, and closes that
 * browser after. The learner is signed in as someone who does not own the chat.
 */
const asAnotherLearner = <A, E, R>(
  browser: Browser,
  baseURL: string,
  use: (page: Page) => Effect.Effect<A, E, R>
) =>
  withBrowserContext(
    browser,
    { baseURL, serviceWorkers: "block", viewport: VIEWPORT },
    (context) =>
      Effect.promise(() => context.newPage()).pipe(
        Effect.flatMap((page) => withObservedPageErrors(page, use(page)))
      )
  );

/**
 * A learner shares a chat and opens it in Nina's sheet, where the owner has a
 * box to write to it. The sheet remembers the chat in the browser. Returns the
 * chat and what the sheet remembered.
 */
const sharesAndRemembers = Effect.fn("NakafaE2E.sharesAndRemembers")(function* (
  page: Page,
  baseURL: string
) {
  const { learner } = yield* openChatPage(page, baseURL);
  const started = yield* learner.startChat(PROMPT);
  yield* learner.titleNewest([TITLE]);
  const token = yield* learner.share(started.chatId);
  yield* Effect.sync(() => expect(token).toMatch(SHARE_TOKEN));

  yield* openSheet(page);
  yield* openFromHistory(page, TITLE);
  yield* Effect.promise(async () => {
    await expect(promptWith(inTheSheet(page), PROMPT)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(composerOf(inTheSheet(page))).toBeVisible();
  });
  const remembered = yield* Effect.promise(() => storedBySheet(page)).pipe(
    Effect.flatMap(Effect.fromNullishOr)
  );
  yield* Effect.sync(() => expect(remembered).toContain(started.chatId));
  return { chatId: started.chatId, remembered };
});

/**
 * Another learner signs in to the browser whose sheet remembers that chat. The
 * id of a chat opens nothing for them, shared or not: its address is the page
 * of a chat that is not there, and the sheet, which reads a chat by its id, gets
 * the same answer. So the sheet shows the same card as the page, which says the
 * chat is not available, and offers nothing to write to it. The learner starts
 * a new chat from the sheet, which forgets that one, and then opens a chat of
 * their own.
 */
const meetsTheChat = Effect.fn("NakafaE2E.meetsTheChat")(function* (
  page: Page,
  baseURL: string,
  shared: { chatId: string; remembered: string }
) {
  const { learner } = yield* openChatPage(page, baseURL);
  yield* learner.startChat(OWN_PROMPT);
  yield* learner.titleNewest([OWN_TITLE]);

  yield* Effect.promise(async () => {
    await page.goto(`/en/chat/${shared.chatId}`);
    await expect(notAvailable(page)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(promptOf(page, PROMPT)).toHaveCount(0);
  });

  yield* Effect.promise(async () => {
    // The sheet reads its storage as the page loads, so the browser holds what
    // the other learner left before the page loads with the sheet.
    await page.goto(LESSON_PATH);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: AI_STORAGE_KEY,
      value: shared.remembered,
    });
    await page.reload();
    // The page loaded with the other learner's chat as the one its sheet has
    // open, and nothing has changed that yet, so the chat the sheet forgets
    // next is that one.
    expect(await storedBySheet(page)).toBe(shared.remembered);
    await page.getByRole("button", { exact: true, name: "Ask Nina" }).click();

    const sheet = inTheSheet(page);

    await expect(notAvailable(sheet)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(sheet.getByText(UNAVAILABLE_COPY)).toBeVisible();
    await expect(composerOf(sheet)).toHaveCount(0);
    await expect(promptWith(sheet, PROMPT)).toHaveCount(0);

    // A new chat is the first item of the sheet's More menu.
    await sheet
      .getByRole("button", { exact: true, name: "More actions" })
      .click();
    await page.getByRole("menuitem", { exact: true, name: "New chat" }).click();
    await expect(sheet.getByText(NEW_CHAT)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(composerOf(sheet)).toBeVisible();
    await expect
      .poll(() => rememberedChat(page), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBeNull();
  });

  yield* openFromHistory(page, OWN_TITLE);
  yield* Effect.promise(async () => {
    const sheet = inTheSheet(page);

    await expect(promptWith(sheet, OWN_PROMPT)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    await expect(composerOf(sheet)).toBeVisible();
    await expect(promptWith(sheet, PROMPT)).toHaveCount(0);
  });
});

test.describe("A chat the learner may not read, at 1440px", () => {
  test.use({ viewport: VIEWPORT });
  test.describe.configure({ timeout: 180_000 });

  test("opens nothing on its page or in a sheet that remembers it, and the sheet lets the learner go on", async ({
    baseURL,
    browser,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const shared = yield* sharesAndRemembers(page, origin);

        yield* asAnotherLearner(browser, origin, (visitor) =>
          meetsTheChat(visitor, origin, shared)
        );
      })
    );
  });
});
