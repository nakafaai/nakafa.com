import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";
import { createHistoryActions } from "@/components/school/classes/forum/conversation/store/runtime/history-actions";

const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one minimal forum post payload for history action tests. */
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

/** Creates one history-action harness with a mutable runtime state object. */
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
  const actions = createHistoryActions({
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

afterEach(() => {
  vi.useRealTimers();
});

describe("conversation/store/runtime/history-actions", () => {
  it("returns early when there is no back history", () => {
    const { actions, state } = createHarness();

    actions.goBack();

    expect(state.backStack).toEqual([]);
  });

  it("restores current history directly when the origin is already loaded", () => {
    const { actions, state } = createHarness();
    const restoredPost = createPost("post_restore", 1);

    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView: {
          kind: "post",
          offset: 14,
          postId: "post_restore" as Id<"schoolClassForumPosts">,
        },
      },
    ];
    state.variant = "focused";
    state.timeline = {
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: restoredPost._id,
      oldestPostId: restoredPost._id,
      posts: [restoredPost],
    };
    state.items = [
      {
        isFirstInGroup: true,
        isLastInGroup: true,
        post: restoredPost,
        showContinuationTime: false,
        type: "post",
      },
    ];
    state.postIdToIndex = new Map([[restoredPost._id, 0]]);

    actions.goBack();

    expect(state.scrollRequest).toMatchObject({
      kind: "restore",
      view: {
        kind: "post",
        offset: 14,
        postId: "post_restore",
      },
    });
  });

  it("routes back-to-bottom through the latest action path", () => {
    const { actions, state } = createHarness();
    const latestAction = vi.fn();

    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView: { kind: "bottom" },
      },
    ];
    state.scrollToLatest = latestAction;

    actions.goBack();

    expect(latestAction).toHaveBeenCalled();
  });

  it("reloads missing back origins and falls back to live mode on failure", async () => {
    const { actions, deps, state } = createHarness();
    const originView = {
      kind: "post",
      offset: 18,
      postId: "post_origin" as Id<"schoolClassForumPosts">,
    } as const;

    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView,
      },
    ];
    deps.fetchAround.mockResolvedValue({
      hasMoreAfter: false,
      hasMoreBefore: false,
      newestPostId: originView.postId,
      oldestPostId: originView.postId,
      posts: [createPost("post_origin", 1)],
    });

    actions.goBack();
    await flushAsyncWork();

    expect(state.scrollRequest).toMatchObject({
      kind: "restore",
      view: originView,
    });

    const failingHarness = createHarness();

    failingHarness.state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView,
      },
    ];
    failingHarness.state.livePosts = [createPost("post_live", 2)];
    failingHarness.deps.fetchAround.mockRejectedValue(
      new Error("goBack failed")
    );

    failingHarness.actions.goBack();
    await flushAsyncWork();

    expect(failingHarness.state.variant).toBe("live");
    expect(failingHarness.state.scrollRequest).toBeNull();
  });

  it("ignores stale async back reloads after a newer focus token replaces them", async () => {
    const { actions, deps, state } = createHarness();

    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView: {
          kind: "post",
          offset: 12,
          postId: "post_origin" as Id<"schoolClassForumPosts">,
        },
      },
    ];
    deps.fetchAround.mockResolvedValue({
      hasMoreAfter: false,
      hasMoreBefore: false,
      newestPostId: "post_origin" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_origin" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_origin", 1)],
    });

    actions.goBack();
    state.focusRequestToken += 1;
    await flushAsyncWork();

    expect(state.scrollRequest).toBeNull();
  });

  it("ignores stale back reload failures after the focus token changes", async () => {
    const { actions, deps, state } = createHarness();

    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView: {
          kind: "post",
          offset: 12,
          postId: "post_origin" as Id<"schoolClassForumPosts">,
        },
      },
    ];
    deps.fetchAround.mockRejectedValue(new Error("goBack failed"));

    actions.goBack();
    state.focusRequestToken += 1;
    await flushAsyncWork();

    expect(state.scrollRequest).toBeNull();
    expect(state.variant).toBe("booting");
  });

  it("schedules highlight state only when the visible post matches the pending highlight", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { actions, state } = createHarness();

    actions.handleHighlightVisiblePost(
      "post_visible" as Id<"schoolClassForumPosts">
    );
    expect(state.highlightedPostId).toBeNull();

    state.pendingHighlightPostId =
      "post_visible" as Id<"schoolClassForumPosts">;
    state.highlightTimeoutId = 123;

    actions.handleHighlightVisiblePost(
      "post_visible" as Id<"schoolClassForumPosts">
    );

    expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
    expect(state.pendingHighlightPostId).toBeNull();
    expect(state.highlightedPostId).toBe("post_visible");

    vi.runAllTimers();

    expect(state.highlightedPostId).toBeNull();
    expect(state.highlightTimeoutId).toBeNull();

    state.pendingHighlightPostId =
      "post_visible" as Id<"schoolClassForumPosts">;
    actions.handleHighlightVisiblePost(
      "post_visible" as Id<"schoolClassForumPosts">
    );
    state.highlightedPostId = "post_other" as Id<"schoolClassForumPosts">;

    vi.runAllTimers();

    expect(state.highlightedPostId).toBe("post_other");
  });

  it("persists settled views and handles loaded, stale, and failed jumps", async () => {
    const { actions, deps, state } = createHarness();
    const loadedPostId = "post_loaded" as Id<"schoolClassForumPosts">;

    actions.handleSettledView({ kind: "bottom" });
    expect(deps.saveConversationView).toHaveBeenCalledWith({ kind: "bottom" });

    state.settledConversationView = { kind: "bottom" };
    state.postIdToIndex = new Map([[loadedPostId, 0]]);
    actions.jumpToPostId(loadedPostId);

    expect(state.pendingHighlightPostId).toBe(loadedPostId);
    expect(state.scrollRequest).toMatchObject({
      kind: "jump",
      postId: loadedPostId,
    });

    const asyncHarness = createHarness();

    asyncHarness.state.settledConversationView = { kind: "bottom" };
    asyncHarness.deps.fetchAround.mockResolvedValue({
      hasMoreAfter: false,
      hasMoreBefore: false,
      newestPostId: "post_async" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_async" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_async", 1)],
    });
    asyncHarness.actions.jumpToPostId(
      "post_async" as Id<"schoolClassForumPosts">
    );
    asyncHarness.state.focusRequestToken += 1;
    await flushAsyncWork();

    expect(asyncHarness.state.scrollRequest).toBeNull();

    const failingHarness = createHarness();

    failingHarness.state.settledConversationView = { kind: "bottom" };
    failingHarness.state.livePosts = [createPost("post_live", 2)];
    failingHarness.deps.fetchAround.mockRejectedValue(new Error("jump failed"));
    failingHarness.actions.jumpToPostId(
      "post_missing" as Id<"schoolClassForumPosts">
    );
    await flushAsyncWork();

    expect(failingHarness.state.highlightedPostId).toBeNull();
    expect(failingHarness.state.pendingHighlightPostId).toBeNull();
    expect(failingHarness.state.variant).toBe("live");

    const staleFailingHarness = createHarness();

    staleFailingHarness.state.settledConversationView = { kind: "bottom" };
    staleFailingHarness.deps.fetchAround.mockRejectedValue(
      new Error("jump failed")
    );
    staleFailingHarness.actions.jumpToPostId(
      "post_missing" as Id<"schoolClassForumPosts">
    );
    staleFailingHarness.state.focusRequestToken += 1;
    await flushAsyncWork();

    expect(staleFailingHarness.state.variant).toBe("booting");
  });

  it("clears back history and returns to latest from the current state", () => {
    const { actions, state } = createHarness();

    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView: { kind: "bottom" },
      },
    ];
    state.livePosts = [createPost("post_live", 1)];
    state.variant = "focused";

    actions.scrollToLatest();

    expect(state.backStack).toEqual([]);
    expect(state.variant).toBe("live");
    expect(state.scrollRequest).toMatchObject({
      kind: "latest",
    });
  });
});
