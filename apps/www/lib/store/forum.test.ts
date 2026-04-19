import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createForumStore,
  type ForumConversationView,
} from "@/lib/store/forum";

const classId = "class_1";
const forumAId = "forum_a" as Id<"schoolClassForums">;
const forumBId = "forum_b" as Id<"schoolClassForums">;
const postId = "post_1" as Id<"schoolClassForumPosts">;

describe("forum store", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("increments session versions per forum independently", () => {
    const store = createForumStore(classId);

    store.getState().restartConversationSession(forumAId);
    store.getState().restartConversationSession(forumAId);
    store.getState().restartConversationSession(forumBId);

    expect(store.getState().conversationSessionVersions).toEqual({
      [forumAId]: 2,
      [forumBId]: 1,
    });
  });

  it("saves semantic conversation snapshots by value", () => {
    const store = createForumStore(classId);
    const firstView = {
      kind: "post",
      offset: 12,
      postId,
    } satisfies ForumConversationView;

    store.getState().saveConversationView(forumAId, firstView);
    store.getState().saveConversationView(forumAId, { ...firstView });
    store.getState().saveConversationView(forumAId, {
      kind: "post",
      offset: 12,
      postId,
    });

    store.getState().saveConversationView(forumAId, {
      kind: "post",
      offset: 24,
      postId,
    });

    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "post",
      offset: 24,
      postId,
    });
  });

  it("treats identical bottom snapshots as the same view", () => {
    const store = createForumStore(classId);

    store.getState().saveConversationView(forumAId, { kind: "bottom" });
    store.getState().saveConversationView(forumAId, { kind: "bottom" });

    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "bottom",
    });
  });

  it("clears transient reply state without touching snapshots or sessions", () => {
    const store = createForumStore(classId);

    store.getState().setReplyTo({ postId, userName: "Nabil" });
    store.getState().restartConversationSession(forumAId);
    store.getState().saveConversationView(forumAId, { kind: "bottom" });
    store.getState().clearTransientConversationState();

    expect(store.getState().replyTo).toBeNull();
    expect(store.getState().conversationSessionVersions[forumAId]).toBe(1);
    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "bottom",
    });
  });

  it("migrates legacy persisted snapshots into the bottom-or-post model", () => {
    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            [forumAId]: {
              kind: "date",
              date: 1_744_775_200_000,
              offset: 18,
              postId,
            },
            [forumBId]: {
              kind: "bottom",
            },
          },
        },
        version: 1,
      })
    );

    const store = createForumStore(classId);

    expect(store.getState().savedConversationViews).toEqual({
      [forumAId]: {
        kind: "post",
        offset: 18,
        postId,
      },
      [forumBId]: {
        kind: "bottom",
      },
    });
  });

  it("drops invalid legacy snapshots and preserves modern persisted state", () => {
    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            forum_invalid: null,
            [forumAId]: {
              kind: "header",
              offset: 12,
              postId: null,
            },
            [forumBId]: {
              kind: "post",
              offset: 6,
              postId,
            },
          },
        },
        version: 1,
      })
    );

    const migratedStore = createForumStore(classId);

    expect(migratedStore.getState().savedConversationViews).toEqual({
      [forumBId]: {
        kind: "post",
        offset: 6,
        postId,
      },
    });

    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            [forumAId]: {
              kind: "bottom",
            },
          },
        },
        version: 2,
      })
    );

    const modernStore = createForumStore(classId);

    expect(modernStore.getState().savedConversationViews).toEqual({
      [forumAId]: {
        kind: "bottom",
      },
    });

    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            [forumBId]: {
              kind: "bottom",
            },
          },
        },
        version: 3,
      })
    );

    const newerStore = createForumStore(classId);

    expect(newerStore.getState().savedConversationViews).toEqual({
      [forumBId]: {
        kind: "bottom",
      },
    });
  });

  it("falls back missing legacy offsets to zero and tolerates empty persisted maps", () => {
    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            [forumAId]: {
              kind: "post",
              postId,
            },
            [forumBId]: {
              kind: "unread",
              postId,
            },
          },
        },
        version: 1,
      })
    );

    const migratedStore = createForumStore(classId);

    expect(migratedStore.getState().savedConversationViews).toEqual({
      [forumAId]: {
        kind: "post",
        offset: 0,
        postId,
      },
      [forumBId]: {
        kind: "post",
        offset: 0,
        postId,
      },
    });

    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {},
        version: 1,
      })
    );

    const emptyStore = createForumStore(classId);

    expect(emptyStore.getState().savedConversationViews).toEqual({});
  });
});
