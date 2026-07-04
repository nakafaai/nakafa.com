import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { createConversationScrollSnapshot } from "@/components/school/classes/forum/conversation/data/scroll/snapshot";

const postId = "post_1" as Id<"schoolClassForumPosts">;

describe("conversation/data/scroll/snapshot", () => {
  it("builds persisted scroll snapshots from settled transcript state", () => {
    expect(
      createConversationScrollSnapshot({
        isAtBottom: false,
        lastPostId: postId,
        offset: 320,
        renderedRowCount: 12,
        view: { kind: "post", postId },
      })
    ).toEqual({
      lastPostId: postId,
      offset: 320,
      renderedRowCount: 12,
      view: { kind: "post", postId },
      wasAtBottom: false,
    });

    expect(
      createConversationScrollSnapshot({
        isAtBottom: true,
        lastPostId: null,
        offset: 0,
        renderedRowCount: 0,
        view: { kind: "bottom" },
      })
    ).toEqual({
      lastPostId: null,
      offset: 0,
      renderedRowCount: 0,
      view: { kind: "bottom" },
      wasAtBottom: true,
    });
  });
});
