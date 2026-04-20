import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  areConversationViewsEqual,
  createForumConversationMode,
  createInitialConversationView,
  isConversationViewAtOrAfter,
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

  it("chooses the first conversation view from mode, unread, and bottom intent", () => {
    expect(
      createInitialConversationView({
        existingView: createPostView(postAId, 18),
        mode: { kind: "live" },
        preferBottom: true,
        unreadPostId: postBId,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationView({
        existingView: null,
        mode: {
          kind: "restore",
          postId: postAId,
          view: createPostView(postAId, 24),
        },
        preferBottom: false,
        unreadPostId: null,
      })
    ).toEqual(createPostView(postAId, 24));

    expect(
      createInitialConversationView({
        existingView: null,
        mode: { kind: "jump", postId: postBId },
        preferBottom: false,
        unreadPostId: null,
      })
    ).toEqual(createPostView(postBId, 0));

    expect(
      createInitialConversationView({
        existingView: { kind: "bottom" },
        mode: { kind: "live" },
        preferBottom: false,
        unreadPostId: null,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationView({
        existingView: null,
        mode: { kind: "live" },
        preferBottom: false,
        unreadPostId: postAId,
      })
    ).toEqual(createPostView(postAId, 0));
  });

  it("compares viewport order for back-history expiry", () => {
    const postIdToIndex = new Map([
      [postAId, 1],
      [postBId, 2],
    ]);

    expect(
      isConversationViewAtOrAfter({
        currentView: { kind: "bottom" },
        postIdToIndex,
        targetView: createPostView(postAId, 0),
      })
    ).toBe(true);

    expect(
      isConversationViewAtOrAfter({
        currentView: createPostView(postBId, 0),
        postIdToIndex,
        targetView: createPostView(postAId, 0),
      })
    ).toBe(true);

    expect(
      isConversationViewAtOrAfter({
        currentView: createPostView(postAId, 12),
        postIdToIndex,
        targetView: createPostView(postAId, 0),
      })
    ).toBe(true);

    expect(
      isConversationViewAtOrAfter({
        currentView: createPostView(postAId, 0),
        postIdToIndex,
        targetView: { kind: "bottom" },
      })
    ).toBe(false);

    expect(
      isConversationViewAtOrAfter({
        currentView: createPostView(postAId, 0),
        postIdToIndex: new Map(),
        targetView: createPostView(postAId, 0),
      })
    ).toBe(false);

    expect(
      isConversationViewAtOrAfter({
        currentView: createPostView(postAId, 0),
        postIdToIndex,
        targetView: createPostView(postAId, 12),
      })
    ).toBe(false);
  });
});
