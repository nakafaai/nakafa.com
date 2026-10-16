import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { openSummary } from "@repo/backend/confect/nina/summaries/text";
import { SUMMARY_FOLD_LIMIT } from "@repo/backend/confect/nina/summaries.spec";
import { Array as Arr, Effect } from "effect";

/** Finds one chat's summary document, when the chat has one. */
export const findSummary = Effect.fn("nina.summaries.find")(function* (
  chatId: Docs["chats"]["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("ninaSummaries")
    .get("by_chatId", chatId)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/** Finds one chat, when it still exists. Its owner holds the key of the summary. */
export const findChat = Effect.fn("nina.summaries.chat")(function* (
  chatId: Docs["chats"]["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("chats")
    .get(chatId)
    .pipe(
      Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
});

/**
 * Reads a chat's summary with its text opened. A summary whose chat is gone
 * reads as none, because only the chat owner's key opens it.
 */
export const readSummary = Effect.fn("nina.summaries.summary")(function* (
  chatId: Docs["chats"]["_id"]
) {
  const summary = yield* findSummary(chatId);
  if (!summary) {
    return null;
  }
  const chat = yield* findChat(chatId);
  if (!chat) {
    return null;
  }
  return {
    text: yield* openSummary(chat.userId, summary.text),
    throughOrder: summary.throughOrder,
  };
});

/**
 * Lists the newest complete turns of a chat after the summary's `through`
 * order and before the order `before`, newest first, at most
 * `SUMMARY_FOLD_LIMIT`. A turn that failed, was cancelled or still runs is not
 * complete, so it never shows up, whatever messages it left in the thread. The
 * index holds the status, so no number of such turns can push a complete one
 * out of the list. A reader that needs the turns beyond the sixteen asks again
 * with `before` set to the oldest order it got.
 */
export const listUncovered = Effect.fn("nina.summaries.uncovered.list")(
  function* ({
    before,
    chatId,
    through,
  }: {
    readonly before: number;
    readonly chatId: Docs["chats"]["_id"];
    readonly through: number | null;
  }) {
    const turns = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .index(
        "by_chatId_and_state_status_and_order",
        (index) =>
          index
            .eq("chatId", chatId)
            .eq("state.status", "complete")
            .gt("order", through ?? -1)
            .lt("order", before),
        "desc"
      )
      .take(SUMMARY_FOLD_LIMIT)
      .pipe(Effect.orDie);
    return Arr.map(turns, (turn) => ({
      order: turn.order,
      ...(turn.retryOf === undefined ? {} : { retryOf: turn.retryOf }),
    }));
  }
);
