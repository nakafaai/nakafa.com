import { expect, type Locator, type Page, test } from "@playwright/test";
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
import { BUBBLE } from "@/e2e/support/selector";
import {
  inTheSheet,
  openSheet,
  promptWith,
  UNAVAILABLE,
  UNCONFIRMED,
} from "@/e2e/support/sheet";
import { mostCopies, watchCopies } from "@/e2e/support/shown";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

declare global {
  interface Window {
    /**
     * How many writes of the persisted AI store still go through once a test
     * arms the refusal. Once none is left, each write is refused. Undefined
     * means nothing is refused.
     */
    nakafaAiWritesAllowed?: number | undefined;
  }
}

const PROMPT = "Why is the derivative of sine the cosine?";
/** The curriculum context a lesson link carries. */
const CONTEXT = "high-school~functions";
/** The Convex name of `nina.messages.page`, the query that reads the messages of a chat. */
const MESSAGES = "nina/messages:page";
/** The address of a chat that the page moves to once its first prompt is admitted. */
const OPENED_CHAT = /\/en\/chat\/[a-z0-9]+$/;

/** The prompt a surface shows as a message: the composer holds the same words as text. */
const promptIn = (scope: Locator) => promptWith(scope, PROMPT);

/** Writes the prompt, and waits until the surface knows who is signed in and lets it be sent. */
const write = async (scope: Locator) => {
  await composerOf(scope).fill(PROMPT);
  await expect(scope.getByRole("button", { name: "Send message" })).toBeEnabled(
    { timeout: readinessTimeoutMilliseconds }
  );
};

/**
 * The prompt shows at once, Nina types after it and the composer is empty. Then
 * the chat opens, and in no frame from the press until then does a reader see
 * the prompt twice: the surface the prompt leaves and the chat it opens never
 * show it together.
 */
const showsAtOnce = (
  scope: Locator,
  changes: Changes,
  opensChat: () => Promise<void>
) =>
  Effect.promise(async () => {
    const page = scope.page();

    await write(scope);
    await watchCopies(page, BUBBLE, PROMPT);
    changes.hold();
    await composerOf(scope).press("Enter");
    await expect(promptIn(scope)).toBeVisible();
    await expect(scope.getByText("Loading", { exact: true })).toBeVisible();
    await expect(composerOf(scope)).toHaveValue("");
    changes.release();
    await opensChat();
    expect(await mostCopies(page)).toBe(1);
  });

/**
 * A prompt the server refuses shows at once, like any other. Once the page
 * learns of the refusal the prompt is gone, the words are back in the composer,
 * the learner is told, and nothing opened.
 */
const givesBackWhenRefused = (page: Page, scope: Locator, changes: Changes) =>
  Effect.promise(async () => {
    await write(scope);
    changes.hold();
    changes.failNext(START);
    await composerOf(scope).press("Enter");
    await expect(promptIn(scope)).toBeVisible();
    changes.release();
    await expect(page.getByText(UNCONFIRMED).first()).toBeVisible();
    await expect(promptIn(scope)).toHaveCount(0);
    await expect(composerOf(scope)).toHaveValue(PROMPT);
    await expect(page).not.toHaveURL(OPENED_CHAT);
  });

/** Waits until the page of the chat that the new chat page moved to holds the prompt. */
const pageOpensChat = (page: Page) => async () => {
  await expect(page).toHaveURL(OPENED_CHAT, {
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(promptIn(onThePage(page))).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
};

/** Waits until the sheet shows the chat its prompt opened, with the answer that failed. */
const sheetOpensChat = (page: Page) => async () => {
  await expect(promptIn(inTheSheet(page))).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(inTheSheet(page).getByText(UNAVAILABLE)).toBeVisible({
    timeout: readinessTimeoutMilliseconds,
  });
  await expect(page).toHaveURL(new RegExp(`${LESSON_PATH}$`));
};

for (const width of [390, 1440]) {
  test.describe(`New chat at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });
    test.describe.configure({ timeout: 180_000 });

    test("the page shows the prompt at once and opens the chat", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);

          yield* showsAtOnce(onThePage(page), changes, pageOpensChat(page));
        })
      );
    });

    test("the page gives a refused prompt back", async ({ baseURL, page }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);

          yield* givesBackWhenRefused(page, onThePage(page), changes);
        })
      );
    });

    test("the sheet shows the prompt at once and opens the chat", async ({
      baseURL,
      page,
    }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);

          yield* openSheet(page);
          yield* showsAtOnce(inTheSheet(page), changes, sheetOpensChat(page));
        })
      );
    });

    test("the sheet gives a refused prompt back", async ({ baseURL, page }) => {
      await runOnPage(page, baseURL, (origin) =>
        Effect.gen(function* () {
          const { changes } = yield* openChatPage(page, origin);

          yield* openSheet(page);
          yield* givesBackWhenRefused(page, inTheSheet(page), changes);
        })
      );
    });
  });
}

/**
 * The learner closes the sheet while their first prompt is on its way, and the
 * server refuses it. The sheet's new chat stops waiting for the answer once it
 * is hidden, yet the words are not lost with it: they are in the composer when
 * the learner opens the sheet again.
 */
const givesBackAfterClosingTheSheet = Effect.fn(
  "NakafaE2E.givesBackAfterClosingTheSheet"
)(function* (page: Page, baseURL: string) {
  const { changes } = yield* openChatPage(page, baseURL);

  yield* openSheet(page);
  yield* Effect.promise(async () => {
    const sheet = inTheSheet(page);
    const hiddenComposer = composerOf(
      page.locator('[data-slot="sheet-popup"]')
    );

    await write(sheet);
    changes.hold();
    changes.failNext(START);
    await composerOf(sheet).press("Enter");
    await expect(promptIn(sheet)).toBeVisible();

    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(hiddenComposer).toBeHidden();
    changes.release();
    await expect(page.getByText(UNCONFIRMED).first()).toBeVisible();
    // The toast covers the entry for a moment, and a press that lands on it
    // holds it there for as long as the pointer stays, so the press waits.
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
      timeout: readinessTimeoutMilliseconds,
    });

    await page.getByRole("button", { exact: true, name: "Ask Nina" }).click();
    await expect(composerOf(inTheSheet(page))).toHaveValue(PROMPT);
  });
});

test.describe("New chat in a sheet closed before the server answers at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("the refused prompt is back in the composer when the sheet opens again", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      givesBackAfterClosingTheSheet(page, origin)
    );
  });
});

/**
 * Refuses the writes of the persisted AI store once the test has armed it, as a
 * full quota does. The store writes on every change, and a new-chat send writes
 * twice before its prompt is on its way: the composer empties, then the chat
 * draft is kept. The test lets as many writes through as it allows, and the
 * store refuses the rest.
 */
function refuseAiStoreWrites(key: string) {
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (name, value) {
    const allowed = window.nakafaAiWritesAllowed;
    if (name === key && allowed !== undefined) {
      if (allowed <= 0) {
        throw new DOMException(
          "The quota has been exceeded.",
          "QuotaExceededError"
        );
      }
      window.nakafaAiWritesAllowed = allowed - 1;
    }
    setItem.call(this, name, value);
  };
}

/**
 * The store refuses the chat draft of a new-chat send, which it writes after the
 * composer is emptied. The prompt leaves at once, and the learner's next send
 * opens the chat.
 */
const refusesTheChatDraft = Effect.fn("NakafaE2E.refusesTheChatDraft")(
  function* (page: Page, baseURL: string) {
    yield* Effect.promise(() =>
      page.addInitScript(refuseAiStoreWrites, AI_STORAGE_KEY)
    );
    yield* openChatPage(page, baseURL);

    yield* Effect.promise(async () => {
      const scope = onThePage(page);

      await write(scope);
      // One write goes through: the one that empties the composer.
      await page.evaluate(() => {
        window.nakafaAiWritesAllowed = 1;
      });
      await composerOf(scope).press("Enter");

      await expect(promptIn(scope)).toHaveCount(0);
      await expect(composerOf(scope)).toBeEnabled();
      await expect(page).not.toHaveURL(OPENED_CHAT);

      await page.evaluate(() => {
        window.nakafaAiWritesAllowed = undefined;
      });
      await write(scope);
      await composerOf(scope).press("Enter");
      await pageOpensChat(page)();
    });
  }
);

test.describe("New chat whose draft the store refuses at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("clears the prompt, and takes the next send", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      refusesTheChatDraft(page, origin)
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
