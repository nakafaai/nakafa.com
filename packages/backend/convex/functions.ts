/**
 * Central trigger registration for Convex database.
 */

import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import {
  internalMutation as rawInternalMutation,
  mutation as rawMutation,
} from "@repo/backend/convex/_generated/server";
// Trigger handlers - direct imports only (no barrel files)
import { chatsHandler } from "@repo/backend/convex/triggers/chats/chats";
import { commentsHandler } from "@repo/backend/convex/triggers/comments/comments";
import { commentVotesHandler } from "@repo/backend/convex/triggers/comments/commentVotes";
import { exerciseAnswersHandler } from "@repo/backend/convex/triggers/contents/exerciseAnswers";
import { exerciseAttemptsHandler } from "@repo/backend/convex/triggers/contents/exerciseAttempts";
import { postReactionsHandler } from "@repo/backend/convex/triggers/forums/postReactions";
import { forumPostsHandler } from "@repo/backend/convex/triggers/forums/posts";
import { forumReactionsHandler } from "@repo/backend/convex/triggers/forums/reactions";
import { materialGroupsHandler } from "@repo/backend/convex/triggers/materials/groups";
import { materialsHandler } from "@repo/backend/convex/triggers/materials/materials";
import { noopHandler } from "@repo/backend/convex/triggers/noop";
import { notificationsHandler } from "@repo/backend/convex/triggers/notifications/notifications";
import { schoolClassesHandler } from "@repo/backend/convex/triggers/schools/classes";
import { schoolClassMembersHandler } from "@repo/backend/convex/triggers/schools/classMembers";
import { schoolMembersHandler } from "@repo/backend/convex/triggers/schools/members";
import { schoolsHandler } from "@repo/backend/convex/triggers/schools/schools";
import { subscriptionsHandler } from "@repo/backend/convex/triggers/subscriptions/subscriptions";
import {
  globalLeaderboardTrigger,
  tryoutLeaderboardTrigger,
} from "@repo/backend/convex/triggers/tryouts/leaderboard";
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

// No-op triggers: tables modified by triggers but don't need custom logic
triggers.register("messages", noopHandler);
triggers.register("parts", noopHandler);
triggers.register("schoolInviteCodes", noopHandler);
triggers.register("schoolClassInviteCodes", noopHandler);
triggers.register("schoolClassForums", noopHandler);
triggers.register("schoolClassForumPendingUploads", noopHandler);
triggers.register("schoolClassForumReadStates", noopHandler);
triggers.register("schoolActivityLogs", noopHandler);
triggers.register("notifications", notificationsHandler);
triggers.register("notificationCounts", noopHandler);
triggers.register("notificationEntityMutes", noopHandler);
triggers.register("notificationPreferences", noopHandler);
triggers.register("schoolClassMaterialAttachments", noopHandler);
triggers.register("schoolClassMaterialViews", noopHandler);
triggers.register("contentAudios", noopHandler);
triggers.register("audioGenerationQueue", noopHandler);
triggers.register("contentViews", noopHandler);
triggers.register("contentViewEvents", noopHandler);
triggers.register("articlePopularity", noopHandler);
triggers.register("subjectPopularity", noopHandler);
triggers.register("exercisePopularity", noopHandler);
triggers.register("creditTransactions", noopHandler);
triggers.register("irtScaleQualityRefreshQueue", noopHandler);
triggers.register("subjectTrendingBuckets", noopHandler);
triggers.register("tryoutAccessCampaigns", noopHandler);
triggers.register("tryoutAccessLinks", noopHandler);
triggers.register("tryoutAccessGrants", noopHandler);
triggers.register("tryoutAccessProductGrants", noopHandler);
triggers.register("users", noopHandler);
triggers.register("subscriptions", subscriptionsHandler);

// Active triggers with custom logic
triggers.register("exerciseAttempts", exerciseAttemptsHandler);
triggers.register("exerciseAnswers", exerciseAnswersHandler);
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

triggers.register("tryoutLeaderboardEntries", tryoutLeaderboardTrigger);
triggers.register("userTryoutStats", globalLeaderboardTrigger);
