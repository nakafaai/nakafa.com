import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";
import type { ForumPost } from "@/components/school/classes/forum/conversation/types";

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
  posts: ForumPost[]
) {
  store.getState().syncLiveWindow({
    hasMoreBefore: false,
    posts,
  });
  store.getState().syncForumStore({
    isHydrated: true,
    savedConversationView: null,
  });
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
});
