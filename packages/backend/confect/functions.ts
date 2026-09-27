/**
 * Central trigger registration for Convex database writes.
 *
 * Use these native Convex mutation builders for mutations that write registered
 * app tables so convex-helpers can run the trigger graph atomically.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 */

// Trigger handlers - direct imports only (no barrel files)
import { runConvexProgram } from "@repo/backend/confect/runtime";
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
  runConvexProgram(subscriptionsHandler(ctx, change))
);
triggers.register("messages", (ctx, change) =>
  runConvexProgram(messagesHandler(ctx, change))
);
triggers.register("learningViews", (ctx, change) =>
  runConvexProgram(learningViewsHandler(ctx, change))
);
triggers.register("comments", (ctx, change) =>
  runConvexProgram(commentsHandler(ctx, change))
);
triggers.register("commentVotes", (ctx, change) =>
  runConvexProgram(commentVotesHandler(ctx, change))
);
triggers.register("chats", (ctx, change) =>
  runConvexProgram(chatsHandler(ctx, change))
);
triggers.register("schools", (ctx, change) =>
  runConvexProgram(schoolsHandler(ctx, change))
);
triggers.register("schoolMembers", (ctx, change) =>
  runConvexProgram(schoolMembersHandler(ctx, change))
);
triggers.register("schoolClasses", (ctx, change) =>
  runConvexProgram(schoolClassesHandler(ctx, change))
);
triggers.register("schoolClassMembers", (ctx, change) =>
  runConvexProgram(schoolClassMembersHandler(ctx, change))
);
// The trigger SDK owns this Promise boundary and the wrapped transaction.
triggers.register("schoolClassForumPosts", (ctx, change) =>
  runConvexProgram(forumPostsHandler(ctx, change))
);
triggers.register("schoolClassForumPostReactions", (ctx, change) =>
  runConvexProgram(postReactionsHandler(ctx, change))
);
triggers.register("schoolClassForumReactions", (ctx, change) =>
  runConvexProgram(forumReactionsHandler(ctx, change))
);
triggers.register("schoolClassMaterialGroups", (ctx, change) =>
  runConvexProgram(materialGroupsHandler(ctx, change))
);
triggers.register("tryoutScores", (ctx, change) =>
  runConvexProgram(tryoutScoresHandler(ctx, change))
);
