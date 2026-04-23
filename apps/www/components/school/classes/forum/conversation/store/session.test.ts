import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { CacheSnapshot } from "virtua";
import { beforeEach, describe, expect, it } from "vitest";
import {
  canRestoreConversationScrollSnapshot,
  createSessionStore,
} from "@/components/school/classes/forum/conversation/store/session";

const forumId = "forum_1" as Id<"schoolClassForums">;
const lastPostId = "post_1" as Id<"schoolClassForumPosts">;
const otherPostId = "post_2" as Id<"schoolClassForumPosts">;
const cache = {} as CacheSnapshot;

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
      rowCount: 12,
    });

    expect(store.getState().savedConversationScrollSnapshots[forumId]).toEqual({
      cache,
      lastPostId,
      offset: 240,
      rowCount: 12,
    });
  });

  it("restores scroll snapshots only when the current list still matches", () => {
    expect(
      canRestoreConversationScrollSnapshot({
        lastPostId,
        rowCount: 12,
        snapshot: {
          cache,
          lastPostId,
          offset: 240,
          rowCount: 12,
        },
      })
    ).toBe(true);

    expect(
      canRestoreConversationScrollSnapshot({
        lastPostId,
        rowCount: 12,
        snapshot: {
          cache,
          lastPostId: otherPostId,
          offset: 240,
          rowCount: 12,
        },
      })
    ).toBe(false);

    expect(
      canRestoreConversationScrollSnapshot({
        lastPostId,
        rowCount: 12,
        snapshot: {
          cache,
          lastPostId,
          offset: 240,
          rowCount: 11,
        },
      })
    ).toBe(false);
  });
});
