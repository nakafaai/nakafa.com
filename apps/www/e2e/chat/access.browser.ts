import { type Browser, expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { AI_STORAGE_KEY } from "@/components/ai/store/create";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  composerOf,
  inTheSheet,
  openFromHistory,
  openSheet,
  promptWith,
} from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const PROMPT = "How do I find the area under a curve?";
const TITLE = "Area under a curve";
const VIEWPORT = { height: 900, width: 1440 };

/** The part of a chat page that holds the conversation, beside the sidebar. */
const onThePage = (page: Page) => page.locator("main main");

/**
 * Runs `use` for a second learner in a browser of their own, and closes that
 * browser after. The learner is signed in as someone who does not own the chat.
 */
const asAnotherLearner = <A, E, R>(
  browser: Browser,
  baseURL: string,
  use: (page: Page) => Effect.Effect<A, E, R>
) =>
  Effect.acquireUseRelease(
    Effect.promise(() =>
      browser.newContext({
        baseURL,
        serviceWorkers: "block",
        viewport: VIEWPORT,
      })
    ),
    (context) =>
      Effect.promise(() => context.newPage()).pipe(
        Effect.flatMap((page) => withObservedPageErrors(page, use(page)))
      ),
    (context) => Effect.promise(() => context.close())
  );

/**
 * A chat that anyone with its link can read belongs to one learner. They write
 * in it on its page and in Nina's sheet, and the sheet remembers the chat. Another
 * learner who opens it, on its page and in a sheet that remembers it, reads
 * the conversation and finds no place to write. Only the owner continues a
 * conversation, the same on every surface.
 */
const onlyTheOwnerWrites = Effect.fn("NakafaE2E.onlyTheOwnerWrites")(function* (
  browser: Browser,
  page: Page,
  baseURL: string
) {
  const { learner } = yield* openChatPage(page, baseURL);
  const started = yield* learner.startChat(PROMPT);
  yield* learner.titleNewest([TITLE]);
  yield* learner.share(started.chatId);

  yield* Effect.promise(async () => {
    await page.goto(`/en/chat/${started.chatId}`);
    await expect(composerOf(onThePage(page))).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
  });
  yield* openSheet(page);
  yield* openFromHistory(page, TITLE);
  const remembered = yield* Effect.promise(async () => {
    await expect(composerOf(inTheSheet(page))).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    return page.evaluate((key) => localStorage.getItem(key), AI_STORAGE_KEY);
  });

  yield* asAnotherLearner(browser, baseURL, (visitor) =>
    Effect.gen(function* () {
      // The sheet of this browser remembers the owner's chat, as it would
      // after one learner signs out and another signs in.
      yield* Effect.promise(() =>
        visitor.addInitScript(
          ({ key, value }) => {
            if (value !== null) {
              localStorage.setItem(key, value);
            }
          },
          { key: AI_STORAGE_KEY, value: remembered }
        )
      );
      yield* openChatPage(visitor, baseURL);

      yield* Effect.promise(async () => {
        await visitor.goto(`/en/chat/${started.chatId}`);
        await expect(promptWith(onThePage(visitor), PROMPT)).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(composerOf(onThePage(visitor))).toHaveCount(0);
      });
      yield* openSheet(visitor);
      yield* Effect.promise(async () => {
        await expect(promptWith(inTheSheet(visitor), PROMPT)).toBeVisible({
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(composerOf(inTheSheet(visitor))).toHaveCount(0);
      });
    })
  );
});

test.describe("Writing in a chat at 1440px", () => {
  test.use({ viewport: VIEWPORT });
  test.describe.configure({ timeout: 180_000 });

  test("only the owner of a chat gets a composer, on its page and in the sheet", async ({
    baseURL,
    browser,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      onlyTheOwnerWrites(browser, page, origin)
    );
  });
});
