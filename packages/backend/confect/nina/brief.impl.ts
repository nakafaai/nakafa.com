import { FunctionImpl, GroupImpl } from "@confect/server";
import schema from "@repo/backend/confect/_generated/schema";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import spec from "@repo/backend/confect/nina/brief.spec";
import { saidOf } from "@repo/backend/confect/nina/memory/said";
import { recallLearner } from "@repo/backend/confect/nina/memory/turn";
import { readMessage } from "@repo/backend/confect/nina/sealed/message";
import {
  listUncovered,
  readSummary,
} from "@repo/backend/confect/nina/summaries/read";
import { Effect, Layer } from "effect";

/**
 * Reads the brief of a turn (`NinaBrief`) in one transaction, which is one
 * function call and one load of its code for the learner's words, what the turn
 * knows of the learner, the summary, and the turns the summary does not cover.
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
    return { learner, summary, uncovered };
  })
);

export default GroupImpl.make(schema, spec).pipe(
  Layer.provide(read),
  GroupImpl.finalize
);
