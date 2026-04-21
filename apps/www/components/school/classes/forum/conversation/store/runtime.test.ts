import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import type {
  ForumConversationView,
  ForumPost,
} from "@/components/school/classes/forum/conversation/models";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";

const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one minimal live forum post for runtime state tests. */
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

/** Creates one bootstrapped runtime store backed by deterministic dependency mocks. */
function createRuntimeStore() {
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

  return { deps, store };
}

/** Boots the runtime into one live window with the provided posts. */
function bootstrapLiveWindow(
  store: ReturnType<typeof createRuntimeStore>["store"],
  posts: ForumPost[],
  hasMoreBefore = false
) {
  store.getState().syncLiveWindow({
    hasMoreBefore,
    posts,
  });
  store.getState().syncForumStore({
    isHydrated: true,
    savedConversationView: null,
  });
}

/** Flushes one async runtime action chain. */
async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("conversation/store/runtime", () => {
  it("creates back history after one settled latest view jumps to another post", () => {
    const { store } = createRuntimeStore();
    const firstPost = createPost("post_1", 1);
    const posts = [firstPost, createPost("post_2", 2)];

    bootstrapLiveWindow(store, posts);
    store.getState().handleSettledView({ kind: "bottom" });
    store.getState().jumpToPostId(firstPost._id);

    expect(store.getState().canGoBack).toBe(true);
    expect(store.getState().scrollRequest).toMatchObject({
      kind: "jump",
      postId: firstPost._id,
    });
  });

  it("keeps back history alive while stale pre-jump settles are still arriving", () => {
    const { deps, store } = createRuntimeStore();
    const firstPost = createPost("post_1", 1);
    const posts = [firstPost, createPost("post_2", 2)];

    bootstrapLiveWindow(store, posts);
    store.getState().handleSettledView({ kind: "bottom" });

    expect(deps.saveConversationView).toHaveBeenCalledTimes(1);

    store.getState().jumpToPostId(firstPost._id);
    store.getState().handleSettledView({ kind: "bottom" });

    expect(store.getState().canGoBack).toBe(true);
    expect(store.getState().pendingJumpProtectionPostId).toBe(firstPost._id);
    expect(deps.saveConversationView).toHaveBeenCalledTimes(1);

    store.getState().handleHighlightVisiblePost(firstPost._id);
    store.getState().handleSettledView({
      kind: "post",
      offset: 120,
      postId: "post_before_target" as Id<"schoolClassForumPosts">,
    });

    expect(store.getState().canGoBack).toBe(true);
    expect(store.getState().pendingJumpProtectionPostId).toBeNull();
    expect(deps.saveConversationView).toHaveBeenCalledTimes(2);
  });

  it("does not create useless back history for a same-place jump", () => {
    const { store } = createRuntimeStore();
    const firstPost = createPost("post_1", 1);
    const posts = [firstPost, createPost("post_2", 2)];

    bootstrapLiveWindow(store, posts);
    store.getState().handleSettledView({
      kind: "post",
      offset: 0,
      postId: firstPost._id,
    });
    store.getState().jumpToPostId(firstPost._id);

    expect(store.getState().canGoBack).toBe(false);
  });

  it("returns to latest and clears history when the captured origin was bottom", () => {
    const { store } = createRuntimeStore();
    const firstPost = createPost("post_1", 1);
    const posts = [firstPost, createPost("post_2", 2)];

    bootstrapLiveWindow(store, posts);
    store.getState().handleSettledView({ kind: "bottom" });
    store.getState().jumpToPostId(firstPost._id);
    store.getState().handleSettledView({
      kind: "post",
      offset: 0,
      postId: firstPost._id,
    });
    store.getState().goBack();

    expect(store.getState().canGoBack).toBe(false);
    expect(store.getState().scrollRequest).toMatchObject({
      kind: "latest",
    });
  });

  it("bootstraps into live latest mode once the persisted forum store hydrates", () => {
    const { store } = createRuntimeStore();
    const posts = [createPost("post_1", 1), createPost("post_2", 2)];

    store.getState().syncLiveWindow({
      hasMoreBefore: true,
      posts,
    });
    store.getState().syncForumStore({
      isHydrated: false,
      savedConversationView: null,
    });

    expect(store.getState().isBootstrapped).toBe(false);

    store.getState().syncForumStore({
      isHydrated: true,
      savedConversationView: null,
    });

    expect(store.getState().isBootstrapped).toBe(true);
    expect(store.getState().variant).toBe("live");
    expect(store.getState().scrollRequest).toMatchObject({
      kind: "latest",
      smooth: false,
    });
  });

  it("bootstraps a saved post restore and falls back to live latest on failure", async () => {
    const restoredView = {
      kind: "post",
      offset: 24,
      postId: "post_restore" as Id<"schoolClassForumPosts">,
    } satisfies ForumConversationView;
    const aroundPost = createPost("post_restore", 10);

    {
      const { deps, store } = createRuntimeStore();

      deps.fetchAround.mockResolvedValue({
        hasMoreAfter: false,
        hasMoreBefore: true,
        newestPostId: aroundPost._id,
        oldestPostId: aroundPost._id,
        posts: [aroundPost],
      });

      store.getState().syncForumStore({
        isHydrated: true,
        savedConversationView: restoredView,
      });
      await flushAsyncWork();

      expect(deps.fetchAround).toHaveBeenCalledWith(restoredView.postId);
      expect(store.getState().variant).toBe("focused");
      expect(store.getState().scrollRequest).toMatchObject({
        kind: "restore",
        view: restoredView,
      });
    }

    {
      const { deps, store } = createRuntimeStore();
      const livePost = createPost("post_live", 1);

      deps.fetchAround.mockRejectedValue(new Error("restore failed"));
      store.getState().syncLiveWindow({
        hasMoreBefore: false,
        posts: [livePost],
      });
      store.getState().syncForumStore({
        isHydrated: true,
        savedConversationView: restoredView,
      });
      await flushAsyncWork();

      expect(store.getState().variant).toBe("live");
      expect(store.getState().scrollRequest).toMatchObject({
        kind: "latest",
      });
    }
  });

  it("delegates live older paging and focused older/newer paging through runtime deps", async () => {
    const { deps, store } = createRuntimeStore();
    const livePosts = [createPost("post_1", 1), createPost("post_2", 2)];

    bootstrapLiveWindow(store, livePosts, true);

    expect(store.getState().loadOlderPosts()).toBe(true);
    expect(deps.loadLiveOlder).toHaveBeenCalled();

    deps.fetchAround.mockResolvedValue({
      hasMoreAfter: true,
      hasMoreBefore: true,
      newestPostId: "post_2" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
      posts: livePosts,
    });
    deps.fetchNewer.mockResolvedValue({
      hasMore: false,
      newestPostId: "post_3" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_3", 3)],
    });
    deps.fetchOlder.mockResolvedValue({
      hasMore: false,
      oldestPostId: "post_0" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_0", 0)],
    });

    store
      .getState()
      .jumpToPostId("post_missing" as Id<"schoolClassForumPosts">);
    await flushAsyncWork();

    expect(store.getState().variant).toBe("focused");
    expect(store.getState().loadNewerPosts()).toBe(true);
    expect(store.getState().loadOlderPosts()).toBe(true);
    await flushAsyncWork();

    expect(deps.fetchNewer).toHaveBeenCalledWith("post_2");
    expect(deps.fetchOlder).toHaveBeenCalledWith("post_1");
    expect(store.getState().timeline?.posts.map((post) => post._id)).toEqual([
      "post_0",
      "post_1",
      "post_2",
      "post_3",
    ]);
  });

  it("clears loading flags when focused paging requests fail", async () => {
    const { deps, store } = createRuntimeStore();
    const focusedPosts = [createPost("post_1", 1), createPost("post_2", 2)];

    deps.fetchAround.mockResolvedValue({
      hasMoreAfter: true,
      hasMoreBefore: true,
      newestPostId: "post_2" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
      posts: focusedPosts,
    });
    deps.fetchNewer.mockRejectedValue(new Error("newer failed"));
    deps.fetchOlder.mockRejectedValue(new Error("older failed"));

    store.getState().jumpToPostId("post_focus" as Id<"schoolClassForumPosts">);
    await flushAsyncWork();

    expect(store.getState().loadNewerPosts()).toBe(true);
    expect(store.getState().loadOlderPosts()).toBe(true);
    await flushAsyncWork();

    expect(store.getState().isLoadingNewer).toBe(false);
    expect(store.getState().isLoadingOlder).toBe(false);
  });

  it("refreshes focused timelines from live updates and handles highlight plus scroll cleanup", async () => {
    const { deps, store } = createRuntimeStore();
    const focusedPost = createPost("post_focus", 1);
    const updatedFocusedPost = {
      ...focusedPost,
      body: "updated",
    };

    deps.fetchAround.mockResolvedValue({
      hasMoreAfter: false,
      hasMoreBefore: false,
      newestPostId: focusedPost._id,
      oldestPostId: focusedPost._id,
      posts: [focusedPost],
    });

    store.getState().syncForumStore({
      isHydrated: true,
      savedConversationView: null,
    });
    store.getState().jumpToPostId(focusedPost._id);
    await flushAsyncWork();

    store.getState().syncLiveWindow({
      hasMoreBefore: false,
      posts: [updatedFocusedPost],
    });

    expect(store.getState().timeline?.posts[0]?.body).toBe("updated");

    store.getState().pendingHighlightPostId = focusedPost._id;
    store.getState().handleHighlightVisiblePost(focusedPost._id);

    expect(store.getState().highlightedPostId).toBe(focusedPost._id);
    expect(store.getState().pendingHighlightPostId).toBeNull();

    store.getState().clearScrollRequest(999);
    expect(store.getState().scrollRequest).not.toBeNull();

    const requestId = store.getState().scrollRequest?.id ?? 0;
    store.getState().clearScrollRequest(requestId);
    expect(store.getState().scrollRequest).toBeNull();
  });

  it("goes back by reloading the origin window when that origin is no longer mounted", async () => {
    const { deps, store } = createRuntimeStore();

    store.setState((state) => {
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
      state.timeline = {
        hasMoreAfter: false,
        hasMoreBefore: false,
        isAtLatestEdge: true,
        isJumpMode: false,
        newestPostId: "post_current" as Id<"schoolClassForumPosts">,
        oldestPostId: "post_current" as Id<"schoolClassForumPosts">,
        posts: [createPost("post_current", 1)],
      };
      state.postIdToIndex = new Map([
        ["post_current" as Id<"schoolClassForumPosts">, 0],
      ]);
      state.variant = "focused";
    });
    deps.fetchAround.mockResolvedValue({
      hasMoreAfter: false,
      hasMoreBefore: false,
      newestPostId: "post_origin" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_origin" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_origin", 2)],
    });

    store.getState().goBack();
    await flushAsyncWork();

    expect(deps.fetchAround).toHaveBeenCalledWith("post_origin");
    expect(store.getState().scrollRequest).toMatchObject({
      kind: "restore",
      view: {
        kind: "post",
        offset: 12,
        postId: "post_origin",
      },
    });
  });
});
