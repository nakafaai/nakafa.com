import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  QueryCtx,
} from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/nina/brief.spec";
import { saidOf } from "@repo/backend/confect/nina/memory/said";
import { recallLearner } from "@repo/backend/confect/nina/memory/turn";
import { readMessage } from "@repo/backend/confect/nina/sealed/message";
import {
  listUncovered,
  readSummary,
} from "@repo/backend/confect/nina/summaries/read";
import { Array as Arr, Effect, Layer } from "effect";

/** The most active connections of a learner the brief reads to find Calendar: one for each connector and room. */
const CONNECTION_READ = 10;

/**
 * Reads the brief of a turn (`NinaBrief`) in one transaction, which is one
 * function call and one load of its code for the learner's words, what the turn
 * knows of the learner, whether they connected Google Calendar, the summary,
 * and the turns the summary does not cover.
 * The summary's order bounds the turns that follow it, so the same read gives
 * both.
 */
const read = FunctionImpl.make(
  schema,
  spec,
  "read",
  Effect.fn("nina.brief.read")(function* ({
    chatId,
    now,
    order,
    promptMessageId,
    topics,
    userId,
  }) {
    const ctx = yield* QueryCtx;
    const prompt = yield* readMessage(ctx, userId, promptMessageId).pipe(
      Effect.orDie
    );
    const learner = yield* recallLearner({
      now,
      said: saidOf(prompt),
      topics,
      userId,
    });
    const summary = yield* readSummary(chatId);
    const uncovered = yield* listUncovered({
      before: order,
      chatId,
      through: summary?.throughOrder ?? null,
    });
    const connected = yield* (yield* DatabaseReader)
      .table("connectorConnections")
      .index("by_userId_and_status", (query) =>
        query.eq("owner.userId", userId).eq("status", "active")
      )
      .take(CONNECTION_READ)
      .pipe(Effect.orDie);
    return {
      calendar: Arr.some(connected, (row) => row.connector === "calendar"),
      learner,
      summary,
      uncovered,
    };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
