import { FunctionImpl, GroupImpl } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/nina/summaries.spec";
import { Clock, Effect, Layer } from "effect";

/** Finds one chat's summary document, when the chat has one. */
const findSummary = Effect.fn("nina.summaries.find")(function* (
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

const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("nina.summaries.read")(function* ({ chatId }) {
    const summary = yield* findSummary(chatId);
    return summary
      ? { text: summary.text, throughOrder: summary.throughOrder }
      : null;
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

/**
 * Stores a refreshed summary. Coverage only moves forward, so a slower refresh
 * never replaces a newer one, but its provider usage still counts; a chat
 * deleted meanwhile gets no orphan.
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
    const chat = yield* (yield* DatabaseReader)
      .table("chats")
      .get(chatId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
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
    if (existing && existing.throughOrder >= throughOrder) {
      yield* writer
        .table("ninaSummaries")
        .patch(existing._id, { usage })
        .pipe(Effect.orDie);
      return null;
    }
    const updatedAt = yield* Clock.currentTimeMillis;
    if (existing) {
      yield* writer
        .table("ninaSummaries")
        .patch(existing._id, { text, throughOrder, updatedAt, usage })
        .pipe(Effect.orDie);
      return null;
    }
    yield* writer
      .table("ninaSummaries")
      .insert({ chatId, text, throughOrder, updatedAt, usage })
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(anchor),
  Layer.provide(read),
  Layer.provide(save),
  GroupImpl.finalize
);
