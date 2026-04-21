import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import { createConversationStore } from "@/components/school/classes/forum/conversation/store/runtime";
import {
  clearHighlightState,
  maybePushCurrentViewToBackStack,
  pruneReachedBackHistory,
} from "@/components/school/classes/forum/conversation/store/runtime/navigation";

const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one mutable runtime state object for navigation helper tests. */
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

describe("conversation/store/runtime/navigation", () => {
  it("clears highlight state and any scheduled timeout", () => {
    const state = createState();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");

    state.highlightTimeoutId = 123;
    state.highlightedPostId = "post_highlighted" as Id<"schoolClassForumPosts">;
    state.pendingHighlightPostId =
      "post_pending" as Id<"schoolClassForumPosts">;

    clearHighlightState(state);

    expect(clearTimeoutSpy).toHaveBeenCalledWith(123);
    expect(state.highlightTimeoutId).toBeNull();
    expect(state.highlightedPostId).toBeNull();
    expect(state.pendingHighlightPostId).toBeNull();
  });

  it("captures meaningful back origins with the right dismiss semantics", () => {
    const state = createState();

    state.settledConversationView = { kind: "bottom" };

    maybePushCurrentViewToBackStack(state, {
      kind: "post",
      offset: 0,
      postId: "post_target" as Id<"schoolClassForumPosts">,
    });

    state.settledConversationView = {
      kind: "post",
      offset: 40,
      postId: "post_current" as Id<"schoolClassForumPosts">,
    };

    maybePushCurrentViewToBackStack(state, { kind: "bottom" });
    maybePushCurrentViewToBackStack(state, {
      kind: "post",
      offset: 0,
      postId: "post_missing" as Id<"schoolClassForumPosts">,
    });

    expect(state.backStack).toEqual([
      {
        dismissWhen: "at-or-after-origin",
        originView: { kind: "bottom" },
      },
      {
        dismissWhen: "at-or-before-origin",
        originView: {
          kind: "post",
          offset: 40,
          postId: "post_current",
        },
      },
      {
        dismissWhen: "exact-origin",
        originView: {
          kind: "post",
          offset: 40,
          postId: "post_current",
        },
      },
    ]);
  });

  it("ignores empty or same-place back origins", () => {
    const state = createState();

    pruneReachedBackHistory(state);
    maybePushCurrentViewToBackStack(state, { kind: "bottom" });

    state.settledConversationView = {
      kind: "post",
      offset: 0,
      postId: "post_same" as Id<"schoolClassForumPosts">,
    };

    maybePushCurrentViewToBackStack(state, {
      kind: "post",
      offset: 0,
      postId: "post_same" as Id<"schoolClassForumPosts">,
    });

    expect(state.backStack).toEqual([]);
  });

  it("treats missing index comparisons as exact-origin matches for the same semantic post", () => {
    const state = createState();

    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView: {
          kind: "post",
          offset: 0,
          postId: "post_missing" as Id<"schoolClassForumPosts">,
        },
      },
    ];
    state.settledConversationView = {
      kind: "post",
      offset: 30,
      postId: "post_missing" as Id<"schoolClassForumPosts">,
    };

    pruneReachedBackHistory(state);

    expect(state.backStack).toEqual([]);
  });

  it("prunes reached back origins across exact, after, and before semantics", () => {
    const state = createState();

    state.postIdToIndex = new Map([
      ["post_a" as Id<"schoolClassForumPosts">, 0],
      ["post_b" as Id<"schoolClassForumPosts">, 1],
      ["post_c" as Id<"schoolClassForumPosts">, 2],
    ]);
    state.backStack = [
      {
        dismissWhen: "exact-origin",
        originView: {
          kind: "post",
          offset: 30,
          postId: "post_b" as Id<"schoolClassForumPosts">,
        },
      },
      {
        dismissWhen: "at-or-after-origin",
        originView: {
          kind: "post",
          offset: 0,
          postId: "post_b" as Id<"schoolClassForumPosts">,
        },
      },
      {
        dismissWhen: "at-or-before-origin",
        originView: {
          kind: "post",
          offset: 0,
          postId: "post_c" as Id<"schoolClassForumPosts">,
        },
      },
    ];

    state.settledConversationView = {
      kind: "post",
      offset: 40,
      postId: "post_b" as Id<"schoolClassForumPosts">,
    };
    pruneReachedBackHistory(state);

    expect(state.backStack).toEqual([
      {
        dismissWhen: "exact-origin",
        originView: {
          kind: "post",
          offset: 30,
          postId: "post_b",
        },
      },
    ]);

    state.settledConversationView = {
      kind: "post",
      offset: 30,
      postId: "post_b" as Id<"schoolClassForumPosts">,
    };
    pruneReachedBackHistory(state);

    expect(state.backStack).toEqual([]);

    state.settledConversationView = {
      kind: "post",
      offset: 0,
      postId: "post_b" as Id<"schoolClassForumPosts">,
    };
    pruneReachedBackHistory(state);

    expect(state.backStack).toEqual([]);

    state.backStack = [
      {
        dismissWhen: "at-or-before-origin",
        originView: {
          kind: "post",
          offset: 0,
          postId: "post_c" as Id<"schoolClassForumPosts">,
        },
      },
    ];
    state.settledConversationView = {
      kind: "post",
      offset: 0,
      postId: "post_c" as Id<"schoolClassForumPosts">,
    };
    pruneReachedBackHistory(state);

    expect(state.backStack).toEqual([]);
  });
});
