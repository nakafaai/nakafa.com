/**
 * Central trigger registration for Convex database writes.
 *
 * Use these native Convex mutation builders for mutations that write registered
 * app tables so convex-helpers can run the trigger graph atomically.
 * @see https://github.com/get-convex/convex-helpers/blob/main/packages/convex-helpers/README.md#triggers
 */

import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from "@repo/backend/convex/_generated/server";
// Trigger handlers - direct imports only (no barrel files)
import { chatsHandler } from "@repo/backend/convex/triggers/chats/chats";
import { messagesHandler } from "@repo/backend/convex/triggers/chats/messages";
import { commentsHandler } from "@repo/backend/convex/triggers/comments/comments";
import { commentVotesHandler } from "@repo/backend/convex/triggers/comments/commentVotes";
import { learningPopularityRankingsTrigger } from "@repo/backend/convex/triggers/contents/popularity";
import { learningViewsHandler } from "@repo/backend/convex/triggers/contents/views";
import { postReactionsHandler } from "@repo/backend/convex/triggers/forums/postReactions";
import { forumPostsHandler } from "@repo/backend/convex/triggers/forums/posts";
import { forumReactionsHandler } from "@repo/backend/convex/triggers/forums/reactions";
import { materialGroupsHandler } from "@repo/backend/convex/triggers/materials/groups";
import { materialsHandler } from "@repo/backend/convex/triggers/materials/materials";
import { notificationsHandler } from "@repo/backend/convex/triggers/notifications/notifications";
import { schoolClassesHandler } from "@repo/backend/convex/triggers/schools/classes";
import { schoolClassMembersHandler } from "@repo/backend/convex/triggers/schools/classMembers";
import { schoolMembersHandler } from "@repo/backend/convex/triggers/schools/members";
import { schoolsHandler } from "@repo/backend/convex/triggers/schools/schools";
import { subscriptionsHandler } from "@repo/backend/convex/triggers/subscriptions/subscriptions";
import {
  customCtx,
  customMutation,
} from "convex-helpers/server/customFunctions";
import { Triggers } from "convex-helpers/server/triggers";

const triggers = new Triggers<DataModel>();

export const mutation = customMutation(rawMutation, customCtx(triggers.wrapDB));
export const internalMutation = customMutation(
  rawInternalMutation,
  customCtx(triggers.wrapDB)
);

// Active triggers with custom logic
triggers.register("notifications", notificationsHandler);
triggers.register("subscriptions", subscriptionsHandler);
triggers.register("messages", messagesHandler);
triggers.register("learningViews", learningViewsHandler);
triggers.register("comments", commentsHandler);
triggers.register("commentVotes", commentVotesHandler);
triggers.register("chats", chatsHandler);
triggers.register("schools", schoolsHandler);
triggers.register("schoolMembers", schoolMembersHandler);
triggers.register("schoolClasses", schoolClassesHandler);
triggers.register("schoolClassMembers", schoolClassMembersHandler);
triggers.register("schoolClassForumPosts", forumPostsHandler);
triggers.register("schoolClassForumPostReactions", postReactionsHandler);
triggers.register("schoolClassForumReactions", forumReactionsHandler);
triggers.register("schoolClassMaterials", materialsHandler);
triggers.register("schoolClassMaterialGroups", materialGroupsHandler);

triggers.register(
  "learningPopularityCounters",
  learningPopularityRankingsTrigger
);
