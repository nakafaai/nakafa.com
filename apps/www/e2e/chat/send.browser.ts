import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { AI_STORAGE_KEY } from "@/components/ai/store/create";
import { composerOf } from "@/e2e/support/attachment";
import type { Changes } from "@/e2e/support/changes";
import {
  LESSON_PATH,
  onThePage,
  openChatPage,
  runOnPage,
  START,
} from "@/e2e/support/chat";
import { PROMPT, pageOpensChat, promptIn, write } from "@/e2e/support/prompt";
import { inTheSheet, promptWith, UNAVAILABLE } from "@/e2e/support/sheet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

declare global {
  interface Window {
    /** Whether the browser refuses the writes of the persisted AI store, which a test arms. */
    nakafaAiWritesRefused?: boolean | undefined;
  }
}

/** The curriculum context a lesson link carries. */
const CONTEXT = "high-school~functions";
/** The Convex name of `nina.messages.page`, the query that reads the messages of a chat. */
const MESSAGES = "nina/messages:page";

/**
 * Refuses the writes of the persisted AI store once the test has armed it, as a
 * full quota does. The store keeps only the chat Nina has open, and writes when
 * that chat changes (#2467). Once the test arms the refusal, every write of the
 * store throws.
 */
function refuseAiStoreWrites(key: string) {
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (name, value) {
    if (name === key && window.nakafaAiWritesRefused) {
      throw new DOMException(
        "The quota has been exceeded.",
        "QuotaExceededError"
      );
    }
    setItem.call(this, name, value);
  };
}

/**
 * A browser that refuses Nina's storage keeps nothing, and the store goes on as a
 * first visit does (#2467): a new-chat send opens its chat, and the chat it opened
 * is not kept for the next load.
 */
const sendsWhileTheStoreRefuses = Effect.fn(
  "NakafaE2E.sendsWhileTheStoreRefuses"
)(function* (page: Page, baseURL: string) {
  yield* Effect.promise(() =>
    page.addInitScript(refuseAiStoreWrites, AI_STORAGE_KEY)
  );
  yield* openChatPage(page, baseURL);

  yield* Effect.promise(async () => {
    const scope = onThePage(page);

    await write(scope);
    await page.evaluate(() => {
      window.nakafaAiWritesRefused = true;
    });
    await composerOf(scope).press("Enter");
    await pageOpensChat(page)();

    // The write that keeps the open chat was refused, and the send went on without it.
    expect(
      await page.evaluate((key) => localStorage.getItem(key), AI_STORAGE_KEY)
    ).toBeNull();
  });
});

test.describe("New chat while the browser refuses Nina's storage at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("opens its chat, and keeps nothing", async ({ baseURL, page }) => {
    await runOnPage(page, baseURL, (origin) =>
      sendsWhileTheStoreRefuses(page, origin)
    );
  });
});

/** The arguments of one start: the page the prompt names. */
const StartArguments = Schema.Tuple([
  Schema.Struct({
    input: Schema.Struct({
      kind: Schema.String,
      page: Schema.Struct({
        locale: Schema.String,
        materialContextHint: Schema.optionalKey(Schema.String),
        slug: Schema.String,
      }),
    }),
  }),
]);

/**
 * Asked from a lesson that a curriculum link opened, the first try names that
 * context, and a retry from the same lesson names it again.
 */
const retriesWithTheLessonContext = Effect.fn(
  "NakafaE2E.retriesWithTheLessonContext"
)(function* (page: Page, baseURL: string) {
  const { changes } = yield* openChatPage(page, baseURL);

  yield* Effect.promise(async () => {
    const sheet = inTheSheet(page);

    await page.goto(`${LESSON_PATH}?ctx=${CONTEXT}`);
    await page.getByRole("button", { exact: true, name: "Ask Nina" }).click();
    await write(sheet);
    await composerOf(sheet).press("Enter");
    await expect(sheet.getByText(UNAVAILABLE)).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    // A chat just started shows its first prompt from the receipt until its
    // messages arrive, and a retry can show its own prompt only among them.
    await expect
      .poll(() => changes.hasAnswered(MESSAGES), {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(true);

    // The retried prompt shows at once, before the server has answered.
    await expect(promptIn(sheet)).toHaveCount(1);
    changes.hold();
    await sheet.getByRole("button", { name: "Retry message" }).click();
    await expect(promptIn(sheet)).toHaveCount(2);
    changes.release();
    await expect
      .poll(() => changes.argumentsOf(START).length, {
        timeout: readinessTimeoutMilliseconds,
      })
      .toBe(2);
  });
  const [first, retry] = yield* Effect.forEach(
    changes.argumentsOf(START),
    (args) => Schema.decodeUnknownEffect(StartArguments)(args)
  );
  yield* Effect.sync(() => {
    expect(first?.[0].input.kind).toBe("message");
    expect(first?.[0].input.page.materialContextHint).toBe(CONTEXT);
    expect(retry?.[0].input.kind).toBe("retry");
    expect(retry?.[0].input.page).toEqual(first?.[0].input.page);
  });
});

test.describe("Retry from a lesson at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("names the lesson context the first try named", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      retriesWithTheLessonContext(page, origin)
    );
  });
});

/** A follow-up to the chat the learner started, which the server refuses. */
const FOLLOW_UP = "And what about the tangent?";
/** What the learner types while the follow-up is on its way. */
const TYPED_WHILE_SENT = "And the normal line?";

/**
 * A follow-up the server refuses goes back to the composer ahead of what the
 * learner typed while it was on its way, so neither is lost. The composer takes
 * the typing while the send is pending, as the new chat's composer does.
 */
const givesBackAheadOfTyping = (page: Page, changes: Changes) =>
  Effect.promise(async () => {
    const scope = onThePage(page);
    const composer = composerOf(scope);

    await composer.fill(FOLLOW_UP);
    await expect(
      scope.getByRole("button", { name: "Send message" })
    ).toBeEnabled({ timeout: readinessTimeoutMilliseconds });
    changes.hold();
    changes.failNext(START);
    await composer.press("Enter");
    await expect(promptWith(scope, FOLLOW_UP)).toBeVisible();
    await composer.fill(TYPED_WHILE_SENT);
    changes.release();

    await expect(promptWith(scope, FOLLOW_UP)).toHaveCount(0);
    await expect(composer).toHaveValue(`${FOLLOW_UP}\n\n${TYPED_WHILE_SENT}`);
  });

test.describe("A follow-up the server refuses at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("goes back to the composer ahead of what the learner typed while it was sent", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        const started = yield* learner.startChat(PROMPT);

        yield* Effect.promise(() => page.goto(`/en/chat/${started.chatId}`));
        yield* givesBackAheadOfTyping(page, changes);
      })
    );
  });
});
