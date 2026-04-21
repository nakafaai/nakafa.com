import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import type { ConversationRuntimeStore } from "@/components/school/classes/forum/conversation/store/runtime/types";
import {
  buildVirtualItems,
  type UnreadCue,
} from "@/components/school/classes/forum/conversation/utils/items";

/** Returns the unread cue still ahead of the current live baseline. */
function getLiveUnreadCue({
  baselineLatestPostId,
  isCueAcknowledged,
  posts,
  transcriptVariant,
}: {
  baselineLatestPostId: Id<"schoolClassForumPosts"> | null;
  isCueAcknowledged: boolean;
  posts: ForumPost[];
  transcriptVariant: "focused" | "live";
}) {
  if (transcriptVariant !== "live" || isCueAcknowledged) {
    return null;
  }

  let count = 0;
  let passedBaselineLatestPost = baselineLatestPostId === null;
  let postId: Id<"schoolClassForumPosts"> | null = null;

  for (const post of posts) {
    if (!passedBaselineLatestPost && post.isUnread === true) {
      postId ??= post._id;
      count += 1;
    }

    if (post._id === baselineLatestPostId) {
      passedBaselineLatestPost = true;
    }
  }

  if (!(postId && count > 0)) {
    return null;
  }

  return {
    count,
    postId,
    status: "new",
  } satisfies UnreadCue;
}

/** Rebuilds the derived transcript state after one source field changes. */
export function syncDerivedState(state: ConversationRuntimeStore) {
  const transcriptVariant = state.variant === "focused" ? "focused" : "live";
  const unreadCue = state.timeline
    ? getLiveUnreadCue({
        baselineLatestPostId: state.baselineLatestPostId,
        isCueAcknowledged: state.isUnreadCueAcknowledged,
        posts: state.timeline.posts,
        transcriptVariant,
      })
    : null;
  const virtualItems = buildVirtualItems({
    forum: state.forum,
    isDetachedMode: transcriptVariant !== "live",
    posts: state.timeline?.posts ?? [],
    unreadCue,
  });

  state.canGoBack = state.backStack.length > 0;
  state.hasMoreAfter = state.timeline?.hasMoreAfter ?? false;
  state.hasMoreBefore = state.timeline?.hasMoreBefore ?? false;
  state.hasPendingLatestPosts =
    transcriptVariant === "focused" &&
    state.liveLatestPostId !== null &&
    state.timeline?.newestPostId !== state.liveLatestPostId;
  state.isAtLatestEdge = state.timeline?.isAtLatestEdge ?? false;
  state.isInitialLoading =
    !state.isBootstrapped ||
    state.timeline === null ||
    (state.variant === "live" && state.livePosts.length === 0);
  state.items = virtualItems.items;
  state.lastPostId = state.timeline?.posts.at(-1)?._id;
  state.postIdToIndex = virtualItems.postIdToIndex;
  state.transcriptVariant = transcriptVariant;
  state.unreadPostId = unreadCue?.postId ?? null;
}

/** Issues one semantic transcript scroll request with a monotonically increasing id. */
export function issueScrollRequest(
  state: ConversationRuntimeStore,
  request: ConversationRuntimeStore["scrollRequest"] extends infer Request
    ? Request extends { id: number }
      ? Omit<Request, "id">
      : never
    : never
) {
  state.scrollRequestId += 1;
  state.scrollRequest = {
    ...request,
    id: state.scrollRequestId,
  };
}
