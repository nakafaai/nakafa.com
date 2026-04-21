import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";
import {
  issueScrollRequest,
  syncDerivedState,
} from "@/components/school/classes/forum/conversation/store/runtime/derived";

const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one minimal forum post payload for runtime-derived state tests. */
function createPost({
  id,
  isUnread = false,
  sequence,
}: {
  id: string;
  isUnread?: boolean;
  sequence: number;
}): ForumPost {
  const createdTime = Date.UTC(2026, 3, 21, 10, sequence, 0);

  return {
    _creationTime: createdTime,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: currentUserId,
    forumId,
    isUnread,
    mentions: [],
    myReactions: [],
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    replyToBody: undefined,
    replyToUser: null,
    replyToUserId: undefined,
    sequence,
    updatedAt: createdTime,
    user: null,
  } satisfies ForumPost;
}

/** Creates one runtime state object that can be mutated directly in tests. */
function createState() {
  const store = createConversationStore({
    currentUserId,
    forumId,
    getDeps: () => ({
      fetchAround: async () => ({
        hasMoreAfter: false,
        hasMoreBefore: false,
        newestPostId: null,
        oldestPostId: null,
        posts: [],
      }),
      fetchNewer: async () => ({
        hasMore: false,
        newestPostId: null,
        posts: [],
      }),
      fetchOlder: async () => ({
        hasMore: false,
        oldestPostId: null,
        posts: [],
      }),
      loadLiveOlder: vi.fn(),
      saveConversationView: vi.fn(),
    }),
    prefersReducedMotion: false,
  });

  return store.getState();
}

describe("conversation/store/runtime/derived", () => {
  it("derives unread cue state only for unread posts ahead of the live baseline", () => {
    const state = createState();
    const unreadFirst = createPost({
      id: "post_1",
      isUnread: true,
      sequence: 1,
    });
    const unreadSecond = createPost({
      id: "post_2",
      isUnread: true,
      sequence: 2,
    });
    const baselinePost = createPost({ id: "post_3", sequence: 3 });

    state.baselineLatestPostId = baselinePost._id;
    state.liveLatestPostId = baselinePost._id;
    state.timeline = {
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: baselinePost._id,
      oldestPostId: unreadFirst._id,
      posts: [unreadFirst, unreadSecond, baselinePost],
    };
    state.variant = "live";
    state.isBootstrapped = true;

    syncDerivedState(state);

    expect(state.transcriptVariant).toBe("live");
    expect(state.unreadPostId).toBe(unreadFirst._id);
    expect(state.lastPostId).toBe(baselinePost._id);
    expect(state.postIdToIndex.get(unreadFirst._id)).toBeGreaterThanOrEqual(0);
    expect(state.items.some((item) => item.type === "unread")).toBe(true);
  });

  it("suppresses unread cue and pending-latest state when the transcript is detached or acknowledged", () => {
    const state = createState();
    const detachedPost = createPost({
      id: "post_detached",
      isUnread: true,
      sequence: 1,
    });
    const liveLatestPost = createPost({ id: "post_live", sequence: 2 });

    state.baselineLatestPostId = detachedPost._id;
    state.liveLatestPostId = liveLatestPost._id;
    state.isUnreadCueAcknowledged = true;
    state.timeline = {
      hasMoreAfter: true,
      hasMoreBefore: true,
      isAtLatestEdge: false,
      isJumpMode: true,
      newestPostId: detachedPost._id,
      oldestPostId: detachedPost._id,
      posts: [detachedPost],
    };
    state.variant = "focused";
    state.isBootstrapped = true;

    syncDerivedState(state);

    expect(state.transcriptVariant).toBe("focused");
    expect(state.unreadPostId).toBeNull();
    expect(state.hasPendingLatestPosts).toBe(true);
    expect(state.isInitialLoading).toBe(false);
  });

  it("keeps initial-loading semantics when the transcript has not bootstrapped yet", () => {
    const state = createState();

    syncDerivedState(state);

    expect(state.isInitialLoading).toBe(true);
    expect(state.items).toEqual([]);
    expect(state.lastPostId).toBeUndefined();
    expect(state.hasPendingLatestPosts).toBe(false);
  });

  it("issues monotonic scroll requests with generated ids", () => {
    const state = createState();

    issueScrollRequest(state, {
      kind: "latest",
      smooth: false,
    });
    issueScrollRequest(state, {
      kind: "jump",
      postId: "post_target" as Id<"schoolClassForumPosts">,
      smooth: true,
    });

    expect(state.scrollRequestId).toBe(2);
    expect(state.scrollRequest).toMatchObject({
      id: 2,
      kind: "jump",
      postId: "post_target",
      smooth: true,
    });
  });
});
