import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { Effect, Scheduler as EffectScheduler } from "effect";

const runTrigger = RegisteredFunction.runHandlerPromise(undefined, {
  scheduler: new EffectScheduler.MixedScheduler("sync"),
});

import { chatsHandler } from "@repo/backend/confect/triggers/chats/chats";
import { messagesHandler } from "@repo/backend/confect/triggers/chats/messages";
import { commentsHandler } from "@repo/backend/confect/triggers/comments/comments";
import { commentVotesHandler } from "@repo/backend/confect/triggers/comments/commentVotes";
import { learningViewsHandler } from "@repo/backend/confect/triggers/contents/views";
import { postReactionsHandler } from "@repo/backend/confect/triggers/forums/postReactions";
import { forumPostsHandler } from "@repo/backend/confect/triggers/forums/posts";
import { forumReactionsHandler } from "@repo/backend/confect/triggers/forums/reactions";
import { materialGroupsHandler } from "@repo/backend/confect/triggers/materials/groups";
import { schoolClassesHandler } from "@repo/backend/confect/triggers/schools/classes";
import { schoolClassMembersHandler } from "@repo/backend/confect/triggers/schools/classMembers";
import { schoolMembersHandler } from "@repo/backend/confect/triggers/schools/members";
import { schoolsHandler } from "@repo/backend/confect/triggers/schools/schools";
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

// Active triggers with custom logic
triggers.register("subscriptions", (ctx, change) =>
  subscriptionsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("messages", (ctx, change) =>
  messagesHandler(change).pipe(
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
triggers.register("schools", (ctx, change) =>
  schoolsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("schoolMembers", (ctx, change) =>
  schoolMembersHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("schoolClasses", (ctx, change) =>
  schoolClassesHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("schoolClassMembers", (ctx, change) =>
  schoolClassMembersHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
// The trigger SDK owns this Promise boundary and the wrapped transaction.
triggers.register("schoolClassForumPosts", (ctx, change) =>
  forumPostsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("schoolClassForumPostReactions", (ctx, change) =>
  postReactionsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("schoolClassForumReactions", (ctx, change) =>
  forumReactionsHandler(change).pipe(
    Effect.provide(RegisteredConvexFunction.mutationLayer(databaseSchema, ctx)),
    runTrigger
  )
);
triggers.register("schoolClassMaterialGroups", (ctx, change) =>
  materialGroupsHandler(change).pipe(
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
