import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  areConversationViewsEqual,
  compareConversationViews,
  createForumConversationMode,
  createInitialConversationView,
} from "@/components/school/classes/forum/conversation/utils/view";

const postAId = "post_a" as Id<"schoolClassForumPosts">;
const postBId = "post_b" as Id<"schoolClassForumPosts">;

function createPostView(postId: Id<"schoolClassForumPosts">, offset = 0) {
  return {
    kind: "post",
    offset,
    postId,
  } as const;
}

describe("forum conversation view state", () => {
  it("falls back to live mode when no restorable snapshot exists", () => {
    expect(createForumConversationMode({ restoreView: null })).toEqual({
      kind: "live",
    });

    expect(
      createForumConversationMode({ restoreView: { kind: "bottom" } })
    ).toEqual({ kind: "live" });
  });

  it("uses restore mode only for saved post snapshots", () => {
    const restoreView = createPostView(postAId, 24);

    expect(createForumConversationMode({ restoreView })).toEqual({
      kind: "restore",
      postId: postAId,
      view: restoreView,
    });
  });

  it("compares conversation views by value", () => {
    expect(areConversationViewsEqual(null, null)).toBe(true);
    expect(areConversationViewsEqual(null, undefined)).toBe(false);
    expect(
      areConversationViewsEqual({ kind: "bottom" }, { kind: "bottom" })
    ).toBe(true);

    expect(
      areConversationViewsEqual(
        createPostView(postAId, 0),
        createPostView(postAId, 0)
      )
    ).toBe(true);

    expect(
      areConversationViewsEqual(
        createPostView(postAId, 0),
        createPostView(postBId, 0)
      )
    ).toBe(false);

    expect(
      areConversationViewsEqual(
        createPostView(postAId, 0),
        createPostView(postAId, 12)
      )
    ).toBe(false);

    expect(
      areConversationViewsEqual({ kind: "bottom" }, createPostView(postAId, 0))
    ).toBe(false);
  });

  it("chooses the first conversation view from mode, unread, and saved bottom state", () => {
    expect(
      createInitialConversationView({
        existingView: null,
        mode: {
          kind: "restore",
          postId: postAId,
          view: createPostView(postAId, 24),
        },
        unreadPostId: null,
      })
    ).toEqual(createPostView(postAId, 24));

    expect(
      createInitialConversationView({
        existingView: null,
        mode: { kind: "jump", postId: postBId },
        unreadPostId: null,
      })
    ).toEqual(createPostView(postBId, 0));

    expect(
      createInitialConversationView({
        existingView: { kind: "bottom" },
        mode: { kind: "live" },
        unreadPostId: null,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationView({
        existingView: null,
        mode: { kind: "live" },
        unreadPostId: postAId,
      })
    ).toEqual(createPostView(postAId, 0));

    expect(
      createInitialConversationView({
        existingView: null,
        mode: { kind: "live" },
        unreadPostId: null,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("compares semantic transcript views in visual order", () => {
    const postIdToIndex = new Map([
      [postAId, 1],
      [postBId, 2],
    ]);

    expect(
      compareConversationViews({
        leftView: { kind: "bottom" },
        postIdToIndex,
        rightView: createPostView(postAId, 0),
      })
    ).toBe(1);

    expect(
      compareConversationViews({
        leftView: createPostView(postAId, 0),
        postIdToIndex,
        rightView: { kind: "bottom" },
      })
    ).toBe(-1);

    expect(
      compareConversationViews({
        leftView: createPostView(postBId, 0),
        postIdToIndex,
        rightView: createPostView(postAId, 0),
      })
    ).toBe(1);

    expect(
      compareConversationViews({
        leftView: createPostView(postAId, 12),
        postIdToIndex,
        rightView: createPostView(postAId, 0),
      })
    ).toBe(1);

    expect(
      compareConversationViews({
        leftView: { kind: "bottom" },
        postIdToIndex,
        rightView: { kind: "bottom" },
      })
    ).toBe(0);

    expect(
      compareConversationViews({
        leftView: createPostView(postAId, 0),
        postIdToIndex: new Map(),
        rightView: createPostView(postAId, 0),
      })
    ).toBeNull();

    expect(
      compareConversationViews({
        leftView: createPostView(postAId, 0),
        postIdToIndex,
        rightView: createPostView(postAId, 0),
      })
    ).toBe(0);

    expect(
      compareConversationViews({
        leftView: createPostView(postAId, 0),
        postIdToIndex,
        rightView: createPostView(postAId, 12),
      })
    ).toBe(-1);
  });
});
