import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  findChat,
  findSummary,
  listUncovered,
  readSummary,
} from "@repo/backend/confect/nina/summaries/read";
import { sealSummary } from "@repo/backend/confect/nina/summaries/text";
import spec from "@repo/backend/confect/nina/summaries.spec";
import { Array as Arr, Clock, Effect, Layer, Option } from "effect";

/** Reads a chat's summary with its text opened (`readSummary`). */
const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("nina.summaries.read")(function* ({ chatId }) {
    return yield* readSummary(chatId);
  })
);

/**
 * Returns the prompt message of the turn at `order`, where a refresh starts
 * reading back, so it reads only the turns it folds.
 */
const anchor = FunctionImpl.make(
  schema,
  spec,
  "anchor",
  Effect.fn("nina.summaries.anchor")(function* ({ chatId, order }) {
    const turn = yield* (yield* DatabaseReader)
      .table("ninaTurns")
      .get("by_chatId_and_order", chatId, order)
      .pipe(
        Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return turn?.promptMessageId ?? null;
  })
);

/** Lists the newest complete turns the summary does not cover (`listUncovered`). */
const uncovered = FunctionImpl.make(
  schema,
  spec,
  "uncovered",
  Effect.fn("nina.summaries.uncovered")(function* (args) {
    return yield* listUncovered(args);
  })
);

/**
 * Lists, for each of `questions`, the newest complete turn before the order
 * `before` that asked it again, wherever it is in the chat. A fold asks this
 * for the questions of the turns it is about to fold, so an answer that a much
 * later retry replaced never reaches the summary. The index holds the status
 * and the order, so each question costs one document, however often the
 * learner asked it again and however many of those turns failed or were
 * stopped.
 */
const asked = FunctionImpl.make(
  schema,
  spec,
  "asked",
  Effect.fn("nina.summaries.asked")(function* ({ before, chatId, questions }) {
    const reader = yield* DatabaseReader;
    const newest = yield* Effect.forEach(questions, (question) =>
      reader
        .table("ninaTurns")
        .index(
          "by_chatId_and_retryOf_and_state_status_and_order",
          (index) =>
            index
              .eq("chatId", chatId)
              .eq("retryOf", question)
              .eq("state.status", "complete")
              .lt("order", before),
          "desc"
        )
        .first()
        .pipe(
          Effect.orDie,
          Effect.map(
            Option.map((turn) => ({ order: turn.order, retryOf: question }))
          )
        )
    );
    return Arr.getSomes(newest);
  })
);

/**
 * Stores a refreshed summary, sealed for the chat owner. Coverage only moves
 * forward, so a slower refresh never replaces a newer one, but its provider
 * usage still counts; a chat deleted meanwhile gets no orphan. A refresh whose
 * answer was rejected sends no text, and its usage counts all the same. A chat
 * that has no summary has no row to count it in, because a row holds text.
 */
const save = FunctionImpl.make(
  schema,
  spec,
  "save",
  Effect.fn("nina.summaries.save")(function* ({
    chatId,
    text,
    throughOrder,
    usage: call,
  }) {
    const chat = yield* findChat(chatId);
    if (!chat) {
      return null;
    }
    const existing = yield* findSummary(chatId);
    const usage = {
      calls: (existing?.usage.calls ?? 0) + 1,
      input: (existing?.usage.input ?? 0) + call.input,
      output: (existing?.usage.output ?? 0) + call.output,
    };
    const writer = yield* DatabaseWriter;
    if (
      text === undefined ||
      (existing && existing.throughOrder >= throughOrder)
    ) {
      if (existing) {
        yield* writer
          .table("ninaSummaries")
          .patch(existing._id, { usage })
          .pipe(Effect.orDie);
      }
      return null;
    }
    const sealed = yield* sealSummary(chat.userId, text);
    const updatedAt = yield* Clock.currentTimeMillis;
    if (existing) {
      yield* writer
        .table("ninaSummaries")
        .patch(existing._id, { text: sealed, throughOrder, updatedAt, usage })
        .pipe(Effect.orDie);
      return null;
    }
    yield* writer
      .table("ninaSummaries")
      .insert({ chatId, text: sealed, throughOrder, updatedAt, usage })
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(anchor),
  Layer.provide(read),
  Layer.provide(save),
  Layer.provide(uncovered),
  Layer.provide(asked),
  GroupImpl.finalize
);
