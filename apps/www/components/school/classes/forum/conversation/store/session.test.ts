import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { CacheSnapshot } from "virtua";
import { beforeEach, describe, expect, it } from "vitest";
import {
  canRestoreConversationScrollCache,
  createSessionStore,
} from "@/components/school/classes/forum/conversation/store/session";

const forumId = "forum_1" as Id<"schoolClassForums">;
const lastPostId = "post_1" as Id<"schoolClassForumPosts">;
const otherPostId = "post_2" as Id<"schoolClassForumPosts">;
const cache = {} as CacheSnapshot;
const replyTo = {
  postId: lastPostId,
  userName: "Nabil",
} as const;

describe("conversation/store/session", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores one conversation scroll snapshot per forum", () => {
    const store = createSessionStore("class-session-test");

    store.getState().saveConversationScrollSnapshot(forumId, {
      cache,
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      wasAtBottom: false,
    });

    expect(store.getState().savedConversationScrollSnapshots[forumId]).toEqual({
      cache,
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      wasAtBottom: false,
    });
  });

  it("rehydrates snapshots manually and keeps volatile composer state out of storage", async () => {
    const writer = createSessionStore("class-session-test");

    writer.getState().saveConversationScrollSnapshot(forumId, {
      cache,
      lastPostId,
      offset: 240,
      renderedRowCount: 12,
      wasAtBottom: true,
    });
    writer.getState().setReplyTo(replyTo);
    writer.getState().setHydrated(true);

    const reader = createSessionStore("class-session-test");

    expect(reader.persist.hasHydrated()).toBe(false);
    expect(reader.getState().savedConversationScrollSnapshots).toEqual({});
    expect(reader.getState().replyTo).toBeNull();
    expect(reader.getState().isHydrated).toBe(false);

    await reader.persist.rehydrate();

    expect(reader.persist.hasHydrated()).toBe(true);
    expect(reader.getState().savedConversationScrollSnapshots[forumId]).toEqual(
      {
        cache,
        lastPostId,
        offset: 240,
        renderedRowCount: 12,
        wasAtBottom: true,
      }
    );
    expect(reader.getState().replyTo).toBeNull();
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
