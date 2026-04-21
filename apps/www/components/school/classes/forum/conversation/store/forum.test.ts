import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createForumStore,
  type ForumConversationView,
} from "@/components/school/classes/forum/conversation/store/forum";

const classId = "class_1";
const forumAId = "forum_a" as Id<"schoolClassForums">;
const forumBId = "forum_b" as Id<"schoolClassForums">;
const postId = "post_1" as Id<"schoolClassForumPosts">;

async function flushHydration() {
  await Promise.resolve();
  await Promise.resolve();
}

function createPostView(
  currentPostId: Id<"schoolClassForumPosts">,
  offset = 0
) {
  return {
    kind: "post",
    offset,
    postId: currentPostId,
  } satisfies ForumConversationView;
}

describe("conversation/store/forum", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("increments session versions per forum independently", async () => {
    const store = createForumStore(classId);
    await flushHydration();

    store.getState().restartConversationSession(forumAId);
    store.getState().restartConversationSession(forumAId);
    store.getState().restartConversationSession(forumBId);

    expect(store.getState().conversationSessionVersions).toEqual({
      [forumAId]: 2,
      [forumBId]: 1,
    });
  });

  it("marks persisted hydration complete after the storage snapshot is merged", async () => {
    const store = createForumStore(classId);

    await flushHydration();

    expect(store.getState().isHydrated).toBe(true);
  });

  it("hydrates saved conversation views from session storage", async () => {
    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            [forumAId]: createPostView(postId, 24),
          },
        },
        version: 7,
      })
    );

    const store = createForumStore(classId);
    await flushHydration();

    expect(store.getState().savedConversationViews).toEqual({
      [forumAId]: createPostView(postId, 24),
    });
    expect(store.getState().isHydrated).toBe(true);
  });

  it("saves semantic conversation snapshots by value", async () => {
    const store = createForumStore(classId);
    await flushHydration();
    const firstView = createPostView(postId, 0);

    store.getState().saveConversationView(forumAId, firstView);
    store.getState().saveConversationView(forumAId, { ...firstView });
    store.getState().saveConversationView(forumAId, createPostView(postId, 0));
    store.getState().saveConversationView(forumAId, createPostView(postId, 24));

    store
      .getState()
      .saveConversationView(
        forumAId,
        createPostView("post_2" as Id<"schoolClassForumPosts">, 12)
      );

    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "post",
      offset: 12,
      postId: "post_2",
    });
  });

  it("treats identical bottom snapshots as the same view", async () => {
    const store = createForumStore(classId);
    await flushHydration();

    store.getState().saveConversationView(forumAId, { kind: "bottom" });
    store.getState().saveConversationView(forumAId, { kind: "bottom" });

    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "bottom",
    });
  });

  it("clears transient reply state without touching snapshots or sessions", async () => {
    const store = createForumStore(classId);
    await flushHydration();

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

  it("resets saved conversation views from older persisted versions once", async () => {
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
    await flushHydration();

    expect(store.getState().savedConversationViews).toEqual({});
  });

  it("clears persisted snapshots from every pre-reset version", async () => {
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
              offset: 0,
              postId,
            },
          },
        },
        version: 1,
      })
    );

    const migratedStore = createForumStore(classId);
    await flushHydration();

    expect(migratedStore.getState().savedConversationViews).toEqual({});

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
    await flushHydration();

    expect(modernStore.getState().savedConversationViews).toEqual({});

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
    await flushHydration();

    expect(newerStore.getState().savedConversationViews).toEqual({});

    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            [forumBId]: createPostView(postId, 32),
          },
        },
        version: 5,
      })
    );

    const latestStore = createForumStore(classId);
    await flushHydration();

    expect(latestStore.getState().savedConversationViews).toEqual({});

    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            [forumBId]: createPostView(postId, 48),
          },
        },
        version: 6,
      })
    );

    const previousStore = createForumStore(classId);
    await flushHydration();

    expect(previousStore.getState().savedConversationViews).toEqual({});
  });

  it("tolerates empty persisted maps from older versions", async () => {
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
    await flushHydration();

    expect(migratedStore.getState().savedConversationViews).toEqual({});

    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {},
        version: 1,
      })
    );

    const emptyStore = createForumStore(classId);
    await flushHydration();

    expect(emptyStore.getState().savedConversationViews).toEqual({});
  });

  it("ignores invalid persisted payloads during migration", async () => {
    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: null,
        version: 1,
      })
    );

    const store = createForumStore(classId);
    await flushHydration();

    expect(store.getState().savedConversationViews).toEqual({});
  });
});
