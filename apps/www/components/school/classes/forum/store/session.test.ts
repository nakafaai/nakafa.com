import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { beforeEach, describe, expect, it } from "vitest";
import { createForumSessionStore } from "@/components/school/classes/forum/store/session";

const forumId = "forum_1" as Id<"schoolClassForums">;
const otherForumId = "forum_2" as Id<"schoolClassForums">;
const lastPostId = "post_1" as Id<"schoolClassForumPosts">;
const otherPostId = "post_2" as Id<"schoolClassForumPosts">;
const replyTarget = {
  postId: lastPostId,
  userName: "Nabil",
} as const;
const otherReplyTarget = {
  postId: otherPostId,
  userName: "Fatih",
} as const;

describe("forum/store/session", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores one conversation scroll snapshot per forum", () => {
    const store = createForumSessionStore("class-session-test");

    store.getState().saveConversationScrollSnapshot(forumId, {
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      view: { kind: "post", postId: lastPostId },
      wasAtBottom: false,
    });

    expect(
      store.getState().conversationScrollSnapshotByForumId[forumId]
    ).toEqual({
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      view: { kind: "post", postId: lastPostId },
      wasAtBottom: false,
    });
  });

  it("stores one reply target per forum", () => {
    const store = createForumSessionStore("class-session-test");

    store.getState().setForumReplyTarget(forumId, replyTarget);
    store.getState().setForumReplyTarget(otherForumId, otherReplyTarget);

    expect(store.getState().replyTargetByForumId[forumId]).toEqual(replyTarget);
    expect(store.getState().replyTargetByForumId[otherForumId]).toEqual(
      otherReplyTarget
    );

    store.getState().setForumReplyTarget(forumId, null);

    expect(store.getState().replyTargetByForumId[forumId]).toBeUndefined();
    expect(store.getState().replyTargetByForumId[otherForumId]).toEqual(
      otherReplyTarget
    );
  });

  it("rehydrates snapshots manually and keeps volatile composer state out of storage", async () => {
    const writer = createForumSessionStore("class-session-test");

    writer.getState().saveConversationScrollSnapshot(forumId, {
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      view: { kind: "bottom" },
      wasAtBottom: true,
    });
    writer.getState().setForumReplyTarget(forumId, replyTarget);
    writer.getState().setHydrated(true);

    const reader = createForumSessionStore("class-session-test");

    expect(reader.persist.hasHydrated()).toBe(false);
    expect(reader.getState().conversationScrollSnapshotByForumId).toEqual({});
    expect(reader.getState().replyTargetByForumId).toEqual({});
    expect(reader.getState().isHydrated).toBe(false);

    await reader.persist.rehydrate();

    expect(reader.persist.hasHydrated()).toBe(true);
    expect(
      reader.getState().conversationScrollSnapshotByForumId[forumId]
    ).toEqual({
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      view: { kind: "bottom" },
      wasAtBottom: true,
    });
    expect(reader.getState().replyTargetByForumId).toEqual({});
    expect(reader.getState().isHydrated).toBe(false);
  });

  it("drops stale persisted scroll snapshots from older session versions", async () => {
    sessionStorage.setItem(
      "nakafa-forum-session:class-session-test",
      JSON.stringify({
        state: {
          conversationScrollSnapshotByForumId: {
            [forumId]: {
              cache: {},
              lastPostId,
              offset: 240,
              renderedRowCount: 12,
              view: { kind: "bottom" },
              wasAtBottom: true,
            },
          },
        },
        version: 2,
      })
    );
    const reader = createForumSessionStore("class-session-test");

    await reader.persist.rehydrate();

    expect(reader.getState().conversationScrollSnapshotByForumId).toEqual({});
  });
});
