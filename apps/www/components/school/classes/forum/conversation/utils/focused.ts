import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/components/school/classes/forum/conversation/store/forum";
import type { ConversationTimeline } from "@/components/school/classes/forum/conversation/utils/timeline";
import type { ForumConversationMode } from "@/components/school/classes/forum/conversation/utils/view";

/** Keep jump, restore, and live windows aligned to one transcript-sized batch. */
export const FORUM_CONVERSATION_WINDOW = 25;

type FocusedTimelineKind = Extract<
  ForumConversationMode,
  { kind: "jump" | "restore" }
>["kind"];

interface FocusedForumWindowResult {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

/** Creates one shared around-query argument object for focused forum windows. */
export function createFocusedWindowArgs({
  forumId,
  targetPostId,
}: {
  forumId: Id<"schoolClassForums">;
  targetPostId: Id<"schoolClassForumPosts">;
}) {
  return {
    forumId,
    limit: FORUM_CONVERSATION_WINDOW,
    targetPostId,
  };
}

/** Creates one detached timeline window from a focused around-post query result. */
export function createFocusedTimelineState({
  aroundResult,
  targetKind,
}: {
  aroundResult: FocusedForumWindowResult;
  targetKind: FocusedTimelineKind;
}): ConversationTimeline {
  const isAtLatestEdge = !aroundResult.hasMoreAfter;

  return {
    hasMoreAfter: aroundResult.hasMoreAfter,
    hasMoreBefore: aroundResult.hasMoreBefore,
    isAtLatestEdge,
    isJumpMode: targetKind === "jump" && !isAtLatestEdge,
    newestPostId: aroundResult.newestPostId,
    oldestPostId: aroundResult.oldestPostId,
    posts: aroundResult.posts,
  };
}
