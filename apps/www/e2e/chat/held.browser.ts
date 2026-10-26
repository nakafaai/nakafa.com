import { expect, type Page, test } from "@playwright/test";
import { Duration, Effect } from "effect";
import { composerOf } from "@/e2e/support/attachment";
import {
  CHAT_PATH,
  LESSON_PATH,
  OPENED_CHAT,
  onThePage,
  openChatPage,
  runOnPage,
} from "@/e2e/support/chat";
import { PROMPT, promptIn } from "@/e2e/support/prompt";
import { inTheSheet, openSheet } from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The session read, which these tests answer late so the viewer loads on screen. */
const SESSION_READ = "**/api/auth/get-session**";
/** How long the session read waits before it answers. */
const SESSION_DELAY = Duration.seconds(2);

/** Answers every later session read of the page late, so a send is pressed before the viewer is known. */
const answerSessionLate = Effect.fn("NakafaE2E.answerSessionLate")(function* (
  page: Page
) {
  const services = yield* Effect.context();
  yield* Effect.promise(() =>
    page.route(SESSION_READ, async (route) => {
      await Effect.runPromiseWith(services)(Effect.sleep(SESSION_DELAY));
      await route.continue();
    })
  );
});

test.describe("A send pressed before the viewer is known", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("the new chat page holds it and opens its chat once the viewer is known", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openChatPage(page, origin);
        yield* answerSessionLate(page);
        yield* Effect.promise(async () => {
          await page.goto(CHAT_PATH);
          const scope = onThePage(page);
          await composerOf(scope).fill(PROMPT);
          await composerOf(scope).press("Enter");
          await expect(page).toHaveURL(OPENED_CHAT, {
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(promptIn(onThePage(page))).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    );
  });

  test("the sheet holds it and opens its chat once the viewer is known", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        yield* openChatPage(page, origin);
        yield* answerSessionLate(page);
        yield* openSheet(page);
        yield* Effect.promise(async () => {
          const sheet = inTheSheet(page);
          await composerOf(sheet).fill(PROMPT);
          await composerOf(sheet).press("Enter");
          await expect(promptIn(sheet)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(page).toHaveURL(new RegExp(`${LESSON_PATH}$`));
        });
      })
    );
  });
});
