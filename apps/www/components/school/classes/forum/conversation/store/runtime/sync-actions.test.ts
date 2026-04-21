import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";
import { createSyncActions } from "@/components/school/classes/forum/conversation/store/runtime/sync-actions";
import type { Forum } from "@/components/school/classes/forum/conversation/types";

const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one minimal forum thread payload for sync action tests. */
function createForum(): Forum {
  const createdTime = Date.UTC(2026, 3, 21, 10, 0, 0);

  return {
    _creationTime: createdTime,
    _id: forumId,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: currentUserId,
    isPinned: false,
    lastPostAt: createdTime,
    lastPostBy: currentUserId,
    myReactions: [],
    nextPostSequence: 2,
    postCount: 1,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: "school_1" as Id<"schools">,
    status: "open",
    tag: "general",
    title: "Forum title",
    updatedAt: createdTime,
    user: null,
  } satisfies Forum;
}

/** Creates one minimal forum post payload for sync action tests. */
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

/** Creates one sync-action harness with a mutable runtime state object. */
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
  const actions = createSyncActions({
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

describe("conversation/store/runtime/sync-actions", () => {
  it("handles simple synchronous store updates directly", () => {
    const { actions, state } = createHarness();
    const forum = createForum();

    state.scrollRequest = {
      id: 1,
      kind: "latest",
      smooth: false,
    };

    actions.acknowledgeUnreadCue();
    actions.clearScrollRequest(999);
    actions.handleBottomStateChange(true);
    actions.syncForum(forum);

    expect(state.isUnreadCueAcknowledged).toBe(true);
    expect(state.scrollRequest).not.toBeNull();
    actions.clearScrollRequest(1);
    expect(state.scrollRequest).toBeNull();
    expect(state.isAtBottom).toBe(true);
    expect(state.forum).toEqual(forum);
  });

  it("waits for hydration before bootstrapping and returns early once already bootstrapped", () => {
    const { actions, state } = createHarness();

    actions.syncForumStore({
      isHydrated: false,
      savedConversationView: null,
    });

    expect(state.isBootstrapped).toBe(false);
    expect(state.variant).toBe("live");

    state.isBootstrapped = true;
    actions.syncForumStore({
      isHydrated: true,
      savedConversationView: null,
    });

    expect(state.variant).toBe("live");
    expect(state.isHydrated).toBe(true);
  });

  it("bootstraps live latest mode when there is no saved post restore target", () => {
    const { actions, state } = createHarness();
    const livePost = createPost("post_live", 1);

    state.livePosts = [livePost];
    state.liveLatestPostId = livePost._id;

    actions.syncForumStore({
      isHydrated: true,
      savedConversationView: null,
    });

    expect(state.isBootstrapped).toBe(true);
    expect(state.variant).toBe("live");
    expect(state.scrollRequest).toMatchObject({
      kind: "latest",
    });
  });

  it("bootstraps a saved restore target and ignores stale async responses", async () => {
    const { actions, deps, state } = createHarness();
    const restoredPost = createPost("post_restore", 1);

    deps.fetchAround.mockResolvedValue({
      hasMoreAfter: false,
      hasMoreBefore: false,
      newestPostId: restoredPost._id,
      oldestPostId: restoredPost._id,
      posts: [restoredPost],
    });

    actions.syncForumStore({
      isHydrated: true,
      savedConversationView: {
        kind: "post",
        offset: 18,
        postId: restoredPost._id,
      },
    });

    state.focusRequestToken += 1;
    await flushAsyncWork();

    expect(state.scrollRequest).toBeNull();
  });

  it("falls back to live latest when restore loading fails, unless the request already went stale", async () => {
    const { actions, deps, state } = createHarness();

    state.livePosts = [createPost("post_live", 1)];
    deps.fetchAround.mockRejectedValue(new Error("restore failed"));
    actions.syncForumStore({
      isHydrated: true,
      savedConversationView: {
        kind: "post",
        offset: 18,
        postId: "post_restore" as Id<"schoolClassForumPosts">,
      },
    });
    await flushAsyncWork();

    expect(state.variant).toBe("live");
    expect(state.scrollRequest).toMatchObject({
      kind: "latest",
    });

    const staleHarness = createHarness();

    staleHarness.deps.fetchAround.mockRejectedValue(
      new Error("restore failed")
    );
    staleHarness.actions.syncForumStore({
      isHydrated: true,
      savedConversationView: {
        kind: "post",
        offset: 18,
        postId: "post_restore" as Id<"schoolClassForumPosts">,
      },
    });
    staleHarness.state.focusRequestToken += 1;
    await flushAsyncWork();

    expect(staleHarness.state.scrollRequest).toBeNull();
  });

  it("syncs live windows before bootstrap, during live mode, and while detached in focused mode", () => {
    const { actions, state } = createHarness();
    const livePost = createPost("post_live", 1);
    const refreshedPost = {
      ...livePost,
      body: "updated",
    };

    actions.syncLiveWindow({
      hasMoreBefore: true,
      posts: [livePost],
    });

    expect(state.liveLatestPostId).toBe(livePost._id);
    expect(state.baselineLatestPostId).toBe(livePost._id);
    expect(state.timeline).toBeNull();

    state.isBootstrapped = true;
    state.pendingLatestScroll = { smooth: true };
    state.variant = "live";

    actions.syncLiveWindow({
      hasMoreBefore: true,
      posts: [livePost],
    });

    expect(state.timeline?.posts).toEqual([livePost]);
    expect(state.scrollRequest).toMatchObject({
      kind: "latest",
      smooth: true,
    });

    state.variant = "focused";
    state.timeline = {
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: livePost._id,
      oldestPostId: livePost._id,
      posts: [livePost],
    };

    actions.syncLiveWindow({
      hasMoreBefore: false,
      posts: [refreshedPost],
    });

    expect(state.timeline?.posts[0]?.body).toBe("updated");
  });

  it("can sync live windows in live mode without requesting latest and in focused mode without a mounted timeline", () => {
    const { actions, state } = createHarness();
    const livePost = createPost("post_live", 1);

    state.isBootstrapped = true;
    state.variant = "live";
    state.pendingLatestScroll = null;

    actions.syncLiveWindow({
      hasMoreBefore: false,
      posts: [livePost],
    });

    expect(state.timeline?.posts).toEqual([livePost]);
    expect(state.scrollRequest).toBeNull();

    state.variant = "focused";
    state.timeline = null;

    actions.syncLiveWindow({
      hasMoreBefore: false,
      posts: [livePost],
    });

    expect(state.timeline).toBeNull();
    expect(state.liveLatestPostId).toBe(livePost._id);
  });
});
