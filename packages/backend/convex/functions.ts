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
import { contentViewsHandler } from "@repo/backend/convex/triggers/contents/contentViews";
import { exerciseAnswersHandler } from "@repo/backend/convex/triggers/contents/exerciseAnswers";
import {
  articlePopularityTrigger,
  exercisePopularityTrigger,
  subjectPopularityTrigger,
} from "@repo/backend/convex/triggers/contents/popularity";
import { postReactionsHandler } from "@repo/backend/convex/triggers/forums/postReactions";
import { forumPostsHandler } from "@repo/backend/convex/triggers/forums/posts";
import { forumReactionsHandler } from "@repo/backend/convex/triggers/forums/reactions";
import { materialGroupsHandler } from "@repo/backend/convex/triggers/materials/groups";
import { materialsHandler } from "@repo/backend/convex/triggers/materials/materials";
import { noopHandler } from "@repo/backend/convex/triggers/noop";
import { schoolClassesHandler } from "@repo/backend/convex/triggers/schools/classes";
import { schoolClassMembersHandler } from "@repo/backend/convex/triggers/schools/classMembers";
import { schoolMembersHandler } from "@repo/backend/convex/triggers/schools/members";
import { schoolsHandler } from "@repo/backend/convex/triggers/schools/schools";
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
triggers.register("schoolClassForumReadStates", noopHandler);
triggers.register("schoolActivityLogs", noopHandler);
triggers.register("notifications", noopHandler);
triggers.register("notificationCounts", noopHandler);
triggers.register("notificationPreferences", noopHandler);
triggers.register("schoolClassMaterialAttachments", noopHandler);
triggers.register("schoolClassMaterialViews", noopHandler);
triggers.register("contentAudios", noopHandler);
triggers.register("audioGenerationQueue", noopHandler);
triggers.register("exerciseAttempts", noopHandler);
triggers.register("creditTransactions", noopHandler);
triggers.register("creditResetJobs", noopHandler);
triggers.register("contentViews", contentViewsHandler);

// Popularity aggregate triggers for trending content
triggers.register("articlePopularity", articlePopularityTrigger);
triggers.register("subjectPopularity", subjectPopularityTrigger);
triggers.register("exercisePopularity", exercisePopularityTrigger);

// Active triggers with custom logic
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
