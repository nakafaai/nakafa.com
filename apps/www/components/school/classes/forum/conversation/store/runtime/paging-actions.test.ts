import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";
import { createPagingActions } from "@/components/school/classes/forum/conversation/store/runtime/paging-actions";

const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one minimal forum post payload for paging action tests. */
function createPost(id: string, sequence: number): ForumPost {
  const createdTime = Date.UTC(2026, 3, 21, 10, sequence, 0);

  return {
    _creationTime: createdTime,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: currentUserId,
    forumId,
    isUnread: false,
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

/** Creates one action harness with a mutable runtime state object. */
function createHarness() {
  const deps = {
    fetchAround: vi.fn(),
    fetchNewer: vi.fn(),
    fetchOlder: vi.fn(),
    loadLiveOlder: vi.fn(),
    saveConversationView: vi.fn(),
  };
  const store = createConversationStore({
    currentUserId,
    forumId,
    getDeps: () => deps,
    prefersReducedMotion: false,
  });
  const state = store.getState();
  const set = (updater: (draft: typeof state) => void) => {
    updater(state);
  };
  const actions = createPagingActions({
    get: () => state,
    getDeps: () => deps,
    set,
  });

  Object.assign(state, actions);

  return { actions, deps, state };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("conversation/store/runtime/paging-actions", () => {
  it("returns false when the current state is not eligible for newer paging", () => {
    const { actions, state } = createHarness();

    expect(actions.loadNewerPosts()).toBe(false);

    state.variant = "focused";
    state.timeline = {
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: null,
      oldestPostId: null,
      posts: [],
    };

    expect(actions.loadNewerPosts()).toBe(false);
  });

  it("appends focused newer history and clears loading even if the variant changes before commit", async () => {
    const { actions, deps, state } = createHarness();
    const currentPost = createPost("post_1", 1);

    state.variant = "focused";
    state.timeline = {
      hasMoreAfter: true,
      hasMoreBefore: false,
      isAtLatestEdge: false,
      isJumpMode: true,
      newestPostId: currentPost._id,
      oldestPostId: currentPost._id,
      posts: [currentPost],
    };

    deps.fetchNewer.mockResolvedValue({
      hasMore: false,
      newestPostId: "post_2" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_2", 2)],
    });

    expect(actions.loadNewerPosts()).toBe(true);
    await flushAsyncWork();

    expect(state.timeline?.posts.map((post) => post._id)).toEqual([
      "post_1",
      "post_2",
    ]);
    expect(state.isLoadingNewer).toBe(false);

    deps.fetchNewer.mockResolvedValue({
      hasMore: true,
      newestPostId: null,
      posts: [createPost("post_4", 4)],
    });
    const currentTimelineAfterAppend = state.timeline;

    if (!currentTimelineAfterAppend) {
      throw new Error("Expected focused timeline after newer append");
    }

    state.timeline = {
      ...currentTimelineAfterAppend,
      hasMoreAfter: true,
      isJumpMode: true,
      newestPostId: "post_2" as Id<"schoolClassForumPosts">,
    };

    expect(actions.loadNewerPosts()).toBe(true);
    await flushAsyncWork();

    expect(state.timeline).toMatchObject({
      hasMoreAfter: true,
      isJumpMode: true,
      newestPostId: "post_2",
    });

    deps.fetchNewer.mockResolvedValue({
      hasMore: false,
      newestPostId: null,
      posts: [createPost("post_3", 3)],
    });
    const currentTimelineBeforeVariantChange = state.timeline;

    if (!currentTimelineBeforeVariantChange) {
      throw new Error("Expected focused timeline before newer variant change");
    }

    state.timeline = {
      ...currentTimelineBeforeVariantChange,
      hasMoreAfter: true,
    };

    expect(actions.loadNewerPosts()).toBe(true);
    state.variant = "live";
    await flushAsyncWork();

    expect(state.isLoadingNewer).toBe(false);
  });

  it("clears newer loading when the request fails", async () => {
    const { actions, deps, state } = createHarness();

    state.variant = "focused";
    state.timeline = {
      hasMoreAfter: true,
      hasMoreBefore: false,
      isAtLatestEdge: false,
      isJumpMode: true,
      newestPostId: "post_1" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_1", 1)],
    };
    deps.fetchNewer.mockRejectedValue(new Error("newer failed"));

    expect(actions.loadNewerPosts()).toBe(true);
    await flushAsyncWork();

    expect(state.isLoadingNewer).toBe(false);
  });

  it("returns false when older paging is unavailable and delegates live older paging to the provider dep", () => {
    const { actions, deps, state } = createHarness();

    expect(actions.loadOlderPosts()).toBe(false);

    state.variant = "live";
    state.timeline = {
      hasMoreAfter: false,
      hasMoreBefore: true,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: "post_2" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_1", 1), createPost("post_2", 2)],
    };

    expect(actions.loadOlderPosts()).toBe(true);
    expect(deps.loadLiveOlder).toHaveBeenCalled();

    state.variant = "focused";
    state.timeline = {
      ...state.timeline,
      oldestPostId: null,
    };

    expect(actions.loadOlderPosts()).toBe(false);
  });

  it("prepends focused older history and clears loading after success or variant changes", async () => {
    const { actions, deps, state } = createHarness();
    const currentPost = createPost("post_2", 2);

    state.variant = "focused";
    state.timeline = {
      hasMoreAfter: false,
      hasMoreBefore: true,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: currentPost._id,
      oldestPostId: currentPost._id,
      posts: [currentPost],
    };

    deps.fetchOlder.mockResolvedValue({
      hasMore: false,
      oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_1", 1)],
    });

    expect(actions.loadOlderPosts()).toBe(true);
    await flushAsyncWork();

    expect(state.timeline?.posts.map((post) => post._id)).toEqual([
      "post_1",
      "post_2",
    ]);
    expect(state.isLoadingOlder).toBe(false);

    deps.fetchOlder.mockResolvedValue({
      hasMore: true,
      oldestPostId: null,
      posts: [createPost("post_0", 0)],
    });
    const currentTimelineAfterPrepend = state.timeline;

    if (!currentTimelineAfterPrepend) {
      throw new Error("Expected focused timeline after older prepend");
    }

    state.timeline = {
      ...currentTimelineAfterPrepend,
      hasMoreBefore: true,
      oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
    };

    expect(actions.loadOlderPosts()).toBe(true);
    await flushAsyncWork();

    expect(state.timeline).toMatchObject({
      hasMoreBefore: true,
      oldestPostId: "post_1",
    });

    deps.fetchOlder.mockResolvedValue({
      hasMore: false,
      oldestPostId: null,
      posts: [createPost("post_0", 0)],
    });
    const currentTimelineBeforeOlderVariantChange = state.timeline;

    if (!currentTimelineBeforeOlderVariantChange) {
      throw new Error("Expected focused timeline before older variant change");
    }

    state.timeline = {
      ...currentTimelineBeforeOlderVariantChange,
      hasMoreBefore: true,
    };

    expect(actions.loadOlderPosts()).toBe(true);
    state.timeline = null;
    await flushAsyncWork();

    expect(state.isLoadingOlder).toBe(false);
  });

  it("clears older loading when the request fails", async () => {
    const { actions, deps, state } = createHarness();

    state.variant = "focused";
    state.timeline = {
      hasMoreAfter: false,
      hasMoreBefore: true,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: "post_2" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_1", 1), createPost("post_2", 2)],
    };
    deps.fetchOlder.mockRejectedValue(new Error("older failed"));

    expect(actions.loadOlderPosts()).toBe(true);
    await flushAsyncWork();

    expect(state.isLoadingOlder).toBe(false);
  });
});
