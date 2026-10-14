import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Effect, Scheduler as EffectScheduler } from "effect";

const runTrigger = RegisteredFunction.runHandlerPromise(undefined, {
  scheduler: new EffectScheduler.MixedScheduler("sync"),
});

import { chatsHandler } from "@repo/backend/confect/triggers/chats/chats";
import { commentsHandler } from "@repo/backend/confect/triggers/comments/comments";
import { commentVotesHandler } from "@repo/backend/confect/triggers/comments/commentVotes";
import { learningViewsHandler } from "@repo/backend/confect/triggers/contents/views";
import { subscriptionsHandler } from "@repo/backend/confect/triggers/subscriptions/subscriptions";
import { tryoutScoresHandler } from "@repo/backend/confect/triggers/tryouts/scores";
import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from "@repo/backend/convex/_generated/server";
import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";
export const triggers = new Triggers<DataModel>();
export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB)
);

// Active triggers with custom logic. The trigger SDK owns this Promise
// boundary and the wrapped transaction.
triggers.register("subscriptions", (ctx, change) =>
  subscriptionsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("learningViews", (ctx, change) =>
  learningViewsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("comments", (ctx, change) =>
  commentsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("commentVotes", (ctx, change) =>
  commentVotesHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("chats", (ctx, change) =>
  chatsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("tryoutScores", (ctx, change) =>
  tryoutScoresHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
