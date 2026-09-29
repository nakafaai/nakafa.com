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
 * Stores a refreshed summary. Coverage only moves forward, so a slower refresh
 * never replaces a newer one, and a chat deleted meanwhile gets no orphan.
 */
const save = FunctionImpl.make(
  schema,
  spec,
  "save",
  Effect.fn("nina.summaries.save")(function* ({ chatId, text, throughOrder }) {
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
    if (existing && existing.throughOrder >= throughOrder) {
      return null;
    }
    const writer = yield* DatabaseWriter;
    const updatedAt = yield* Clock.currentTimeMillis;
    if (existing) {
      yield* writer
        .table("ninaSummaries")
        .patch(existing._id, { text, throughOrder, updatedAt })
        .pipe(Effect.orDie);
      return null;
    }
    yield* writer
      .table("ninaSummaries")
      .insert({ chatId, text, throughOrder, updatedAt })
      .pipe(Effect.orDie);
    return null;
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(read),
  Layer.provide(save),
  GroupImpl.finalize
);
