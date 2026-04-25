import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { CacheSnapshot } from "virtua";
import { beforeEach, describe, expect, it } from "vitest";
import {
  canRestoreConversationScrollCache,
  createForumSessionStore,
} from "@/components/school/classes/forum/store/session";

const forumId = "forum_1" as Id<"schoolClassForums">;
const otherForumId = "forum_2" as Id<"schoolClassForums">;
const lastPostId = "post_1" as Id<"schoolClassForumPosts">;
const otherPostId = "post_2" as Id<"schoolClassForumPosts">;
const cache = {} as CacheSnapshot;
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
      cache,
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      wasAtBottom: false,
    });

    expect(
      store.getState().conversationScrollSnapshotByForumId[forumId]
    ).toEqual({
      cache,
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
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
      cache,
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
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
      cache,
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      wasAtBottom: true,
    });
    expect(reader.getState().replyTargetByForumId).toEqual({});
    expect(reader.getState().isHydrated).toBe(false);
  });

  it("reuses cache only when the rendered transcript still matches", () => {
    expect(
      canRestoreConversationScrollCache({
        lastPostId,
        renderedRowCount: 12,
        snapshot: {
          cache,
          lastPostId,
          offset: 240,
          renderedRowCount: 12,
          wasAtBottom: false,
        },
      })
    ).toBe(true);

    expect(
      canRestoreConversationScrollCache({
        lastPostId,
        renderedRowCount: 12,
        snapshot: {
          cache,
          lastPostId: otherPostId,
          offset: 240,
          renderedRowCount: 12,
          wasAtBottom: false,
        },
      })
    ).toBe(false);

    expect(
      canRestoreConversationScrollCache({
        lastPostId,
        renderedRowCount: 12,
        snapshot: {
          cache: null,
          lastPostId,
          offset: 240,
          renderedRowCount: 12,
          wasAtBottom: false,
        },
      })
    ).toBe(false);

    expect(
      canRestoreConversationScrollCache({
        lastPostId,
        renderedRowCount: 12,
        snapshot: {
          cache,
          lastPostId,
          offset: 240,
          renderedRowCount: 11,
          wasAtBottom: false,
        },
      })
    ).toBe(false);

    expect(
      canRestoreConversationScrollCache({
        lastPostId,
        renderedRowCount: 12,
        snapshot: null,
      })
    ).toBe(false);
  });
});
