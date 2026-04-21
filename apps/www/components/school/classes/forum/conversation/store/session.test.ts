import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { beforeEach, describe, expect, it } from "vitest";
import type { ForumConversationView } from "@/components/school/classes/forum/conversation/models";
import { createForumSessionStore } from "@/components/school/classes/forum/conversation/store/session";

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

describe("conversation/store/session", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("increments session versions per forum independently", async () => {
    const store = createForumSessionStore(classId);
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
    const store = createForumSessionStore(classId);
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
        version: 8,
      })
    );

    const store = createForumSessionStore(classId);
    await flushHydration();

    expect(store.getState().savedConversationViews).toEqual({
      [forumAId]: createPostView(postId, 24),
    });
    expect(store.getState().isHydrated).toBe(true);
  });

  it("saves semantic conversation snapshots by value", async () => {
    const store = createForumSessionStore(classId);
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
    const store = createForumSessionStore(classId);
    await flushHydration();

    store.getState().saveConversationView(forumAId, { kind: "bottom" });
    store.getState().saveConversationView(forumAId, { kind: "bottom" });

    expect(store.getState().savedConversationViews[forumAId]).toEqual({
      kind: "bottom",
    });
  });

  it("clears transient reply state without touching snapshots or sessions", async () => {
    const store = createForumSessionStore(classId);
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

    const store = createForumSessionStore(classId);
    await flushHydration();

    expect(store.getState().savedConversationViews).toEqual({});
  });

  it("keeps version 8 snapshots intact", async () => {
    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: {
          savedConversationViews: {
            [forumAId]: createPostView(postId, 16),
            [forumBId]: { kind: "bottom" },
          },
        },
        version: 8,
      })
    );

    const store = createForumSessionStore(classId);
    await flushHydration();

    expect(store.getState().savedConversationViews).toEqual({
      [forumAId]: createPostView(postId, 16),
      [forumBId]: { kind: "bottom" },
    });
  });

  it("ignores invalid persisted payloads during migration", async () => {
    sessionStorage.setItem(
      `forum-ui:${classId}`,
      JSON.stringify({
        state: null,
        version: 1,
      })
    );

    const store = createForumSessionStore(classId);
    await flushHydration();

    expect(store.getState().savedConversationViews).toEqual({});
  });
});
