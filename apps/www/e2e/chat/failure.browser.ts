import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { onThePage, openChatPage, runOnPage } from "@/e2e/support/chat";
import { withBrowserContext } from "@/e2e/support/context";
import { CONVERSATION } from "@/e2e/support/query";
import { sidebarRows } from "@/e2e/support/rows";
import { ACCESS_TITLE, UNAVAILABLE_COPY } from "@/e2e/support/share";
import {
  inTheSheet,
  openFromHistory,
  openSheet,
  promptWith,
} from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const PROMPT = "Why is the derivative of sine the cosine?";
const TITLE = "The derivative of sine";
/** The typed failure the server sends when the viewer may not read the chat. */
const FORBIDDEN = {
  _tag: "ChatAccessError",
  code: "FORBIDDEN",
  message: "This chat is not available.",
};
const FAILED_TITLE = en.Ai["chat-failed"];
const FAILED_COPY = en.Ai["chat-failed-description"];
const RETRY = en.Ai.retry;
/** The Google sign-in button a signed-out visitor is offered. */
const GOOGLE_SIGN_IN = /google/i;
/** The Next.js code chunks, and the request the new chat page's weather widget makes. */
const CHUNK = /\/_next\/static\/chunks\/.+\.js$/;
const WEATHER_REQUEST = "/api/weather";

/** The failure card of a chat surface, which is the `Empty` part the card is built from. */
const cardOf = (scope: Page | Locator) => scope.locator('[data-slot="empty"]');

/** Waits until the page shows the card with this title. */
const showsCard = (scope: Page | Locator, title: string) =>
  expect(cardOf(scope).filter({ hasText: title })).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });

test.describe("A chat that cannot be read, at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("says the chat is not available to the viewer, then that Nakafa could not load it, and retrying loads it", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        const started = yield* learner.startChat(PROMPT);
        yield* learner.titleNewest([TITLE]);
        const address = `/en/chat/${started.chatId}`;

        changes.failQuery(CONVERSATION, FORBIDDEN);
        yield* Effect.promise(() => page.goto(address));
        yield* Effect.promise(async () => {
          await showsCard(page, ACCESS_TITLE);
          await expect(page.getByText(UNAVAILABLE_COPY)).toBeVisible();
          await expect(page.getByRole("button", { name: RETRY })).toHaveCount(
            0
          );
        });

        changes.failQuery(CONVERSATION, undefined);
        yield* Effect.promise(() => page.goto(address));
        yield* Effect.promise(async () => {
          await showsCard(page, FAILED_TITLE);
          await expect(page.getByText(FAILED_COPY)).toBeVisible();
          await expect(page.getByText(ACCESS_TITLE)).toHaveCount(0);
        });

        changes.recoverQuery();
        yield* Effect.promise(async () => {
          await page.getByRole("button", { name: RETRY }).click();
          await expect(promptWith(onThePage(page), PROMPT)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(page.getByText(FAILED_TITLE)).toHaveCount(0);
        });
      })
    );
  });

  test("tells a signed-out visitor the chat is not available, with the sign-in button", async ({
    baseURL,
    browser,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { learner } = yield* openChatPage(page, origin);
        const started = yield* learner.startChat(PROMPT);
        yield* learner.titleNewest([TITLE]);
        const address = `/en/chat/${started.chatId}`;

        yield* withBrowserContext(
          browser,
          { baseURL: origin, viewport: { height: 900, width: 1440 } },
          (context) =>
            Effect.promise(async () => {
              const visitor = await context.newPage();
              await visitor.goto(address);
              await showsCard(visitor, ACCESS_TITLE);
              await expect(visitor.getByText(UNAVAILABLE_COPY)).toBeVisible();
              await expect(
                visitor.getByRole("button", { name: GOOGLE_SIGN_IN })
              ).toBeVisible();
            })
        );
      })
    );
  });

  test("shows the sheet's chat failure card with a retry, and the retry reads the chat again", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        yield* learner.startChat(PROMPT);
        yield* learner.titleNewest([TITLE]);

        changes.failQuery(CONVERSATION, undefined);
        yield* openSheet(page);
        yield* openFromHistory(page, TITLE);
        yield* Effect.promise(async () => {
          await showsCard(inTheSheet(page), FAILED_TITLE);
          await expect(inTheSheet(page).getByText(FAILED_COPY)).toBeVisible();
        });

        changes.recoverQuery();
        yield* Effect.promise(async () => {
          await inTheSheet(page).getByRole("button", { name: RETRY }).click();
          await expect(promptWith(inTheSheet(page), PROMPT)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
        });
      })
    );
  });

  test("shows the new chat page's failure card when its content cannot load, and the card goes when the learner opens a chat", async ({
    baseURL,
    page,
  }) => {
    // The weather widget's code is the one the new chat page loads after it
    // renders. Without it, the page's content fails to render.
    await page.route(CHUNK, async (route) => {
      const response = await route.fetch();
      if ((await response.body()).includes(WEATHER_REQUEST)) {
        await route.abort();
        return;
      }
      await route.fulfill({ response });
    });
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { learner } = yield* openChatPage(page, origin);
        const started = yield* learner.startChat(PROMPT);
        yield* learner.titleNewest([TITLE]);

        yield* Effect.promise(async () => {
          await showsCard(page, FAILED_TITLE);
          await expect(page.getByText(FAILED_COPY)).toBeVisible();
        });

        yield* Effect.promise(async () => {
          await sidebarRows(page).filter({ hasText: TITLE }).click();
          await expect(page).toHaveURL(
            new RegExp(`/en/chat/${started.chatId}$`),
            { timeout: readinessTimeoutMilliseconds }
          );
          await expect(promptWith(onThePage(page), PROMPT)).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          });
          await expect(page.getByText(FAILED_TITLE)).toHaveCount(0);
        });
      })
    );
  });
});
