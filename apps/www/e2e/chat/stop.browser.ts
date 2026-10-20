import { expect, type Locator, test } from "@playwright/test";
import { Clock, Effect, Schema } from "effect";
import { composerOf } from "../support/attachment";
import type { Changes } from "../support/changes";
import {
  LESSON_PATH,
  onThePage,
  openChatPage,
  runOnPage,
} from "../support/chat";
import { CONVERSATION } from "../support/query";
import { inTheSheet, openFromHistory, openSheet } from "../support/sheet";
import { readinessTimeoutMilliseconds } from "../support/timeout";

const PROMPT = "Why is the derivative of sine the cosine?";
const TITLE = "The derivative of sine";
/** What the learner types while Nina answers, which Enter must keep. */
const FOLLOW_UP = "And what about the tangent?";
/** The Convex name of the mutation that stops a turn. */
const CANCEL = "nina/lifecycle:cancel";
const STOP = "Stop response";

/** A conversation answer that has a latest turn to read. */
const WithTurn = Schema.Struct({
  turn: Schema.Struct({ state: Schema.Unknown }),
});
const isWithTurn = Schema.is(WithTurn);

/**
 * The conversation as a backend that is still answering would give it: the
 * latest turn runs, so Nina's answer is in progress. The local backend cannot
 * answer a turn, so the test shows the turn as running through the tracker.
 */
const running = (startedAt: number) => (value: unknown) =>
  isWithTurn(value)
    ? {
        ...value,
        turn: { ...value.turn, state: { startedAt, status: "running" } },
      }
    : value;

/**
 * Types a follow-up while Nina answers and presses Enter. Enter keeps the
 * words, sends nothing and stops nothing: the stop button is still there, and
 * the server gets no stop. The stop button then stops the answer.
 */
const enterKeepsTheWords = Effect.fn("NakafaE2E.enterKeepsTheWords")(function* (
  scope: Locator,
  changes: Changes
) {
  const composer = composerOf(scope);
  const stop = scope.getByRole("button", { name: STOP });
  const stopsBefore = changes.argumentsOf(CANCEL).length;

  yield* Effect.promise(async () => {
    await expect(stop).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await composer.fill(FOLLOW_UP);
    await composer.press("Enter");
  });
  yield* Effect.promise(async () => {
    await expect(composer).toHaveValue(FOLLOW_UP);
    await expect(stop).toBeVisible();
  });
  yield* Effect.sync(() =>
    expect(changes.argumentsOf(CANCEL)).toHaveLength(stopsBefore)
  );

  yield* Effect.promise(() => stop.click());
  yield* Effect.promise(() =>
    expect.poll(() => changes.argumentsOf(CANCEL).length).toBe(stopsBefore + 1)
  );
});

test.describe("Enter while Nina answers, at 1440px", () => {
  test.use({ viewport: { height: 900, width: 1440 } });
  test.describe.configure({ timeout: 180_000 });

  test("keeps what the learner typed and never stops the answer, on the page and in the sheet", async ({
    baseURL,
    page,
  }) => {
    await runOnPage(page, baseURL, (origin) =>
      Effect.gen(function* () {
        const { changes, learner } = yield* openChatPage(page, origin);
        const started = yield* learner.startChat(PROMPT);
        yield* learner.titleNewest([TITLE]);
        const now = yield* Clock.currentTimeMillis;
        changes.rewrite(CONVERSATION, running(now));

        yield* Effect.promise(() => page.goto(`/en/chat/${started.chatId}`));
        yield* enterKeepsTheWords(onThePage(page), changes);

        yield* Effect.promise(() => page.goto(LESSON_PATH));
        yield* openSheet(page);
        yield* openFromHistory(page, TITLE);
        yield* enterKeepsTheWords(inTheSheet(page), changes);
      })
    );
  });
});
