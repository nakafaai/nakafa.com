import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { CacheSnapshot } from "virtua";
import { describe, expect, it } from "vitest";
import {
  createConversationScrollSnapshot,
  getInitialConversationRestoreTarget,
} from "@/components/school/classes/forum/conversation/data/scroll-snapshot";

const postId = "post_1" as Id<"schoolClassForumPosts">;
const cache = {} as CacheSnapshot;

describe("conversation/data/scroll-snapshot", () => {
  it("reopens at bottom when the latest snapshot says the viewer was at bottom", () => {
    expect(
      getInitialConversationRestoreTarget({
        savedScrollSnapshot: {
          cache,
          lastPostId: postId,
          offset: 320,
          renderedRowCount: 12,
          wasAtBottom: true,
        },
        unreadCue: {
          count: 3,
          postId,
          status: "new",
        },
      })
    ).toEqual({ kind: "bottom" });
  });

  it("reuses the last saved offset before falling back to unread or bottom", () => {
    expect(
      getInitialConversationRestoreTarget({
        savedScrollSnapshot: {
          cache,
          lastPostId: postId,
          offset: 320,
          renderedRowCount: 12,
          wasAtBottom: false,
        },
        unreadCue: {
          count: 3,
          postId,
          status: "new",
        },
      })
    ).toEqual({
      kind: "offset",
      offset: 320,
    });
  });

  it("falls back to the first unread post when no saved snapshot exists", () => {
    expect(
      getInitialConversationRestoreTarget({
        savedScrollSnapshot: null,
        unreadCue: {
          count: 3,
          postId,
          status: "new",
        },
      })
    ).toEqual({
      align: "start",
      kind: "post",
      postId,
    });
  });

  it("falls back to bottom when neither snapshot nor unread cue exists", () => {
    expect(
      getInitialConversationRestoreTarget({
        savedScrollSnapshot: null,
        unreadCue: null,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("builds persisted scroll snapshots from settled transcript state", () => {
    expect(
      createConversationScrollSnapshot({
        cache,
        isAtBottom: false,
        lastPostId: postId,
        offset: 320,
        renderedRowCount: 12,
      })
    ).toEqual({
      cache,
      lastPostId: postId,
      offset: 320,
      renderedRowCount: 12,
      wasAtBottom: false,
    });

    expect(
      createConversationScrollSnapshot({
        cache: null,
        isAtBottom: true,
        lastPostId: null,
        offset: 0,
        renderedRowCount: 0,
      })
    ).toEqual({
      cache: null,
      lastPostId: null,
      offset: 0,
      renderedRowCount: 0,
      wasAtBottom: true,
    });
  });
});
