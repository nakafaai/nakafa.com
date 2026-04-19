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
    const restoreView = {
      kind: "post",
      offset: -8,
      postId: postAId,
    } as const;

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
        { kind: "post", offset: 4, postId: postAId },
        { kind: "post", offset: 4, postId: postAId }
      )
    ).toBe(true);

    expect(
      areConversationViewsEqual(
        { kind: "post", offset: 4, postId: postAId },
        { kind: "post", offset: 5, postId: postAId }
      )
    ).toBe(false);

    expect(
      areConversationViewsEqual(
        { kind: "bottom" },
        { kind: "post", offset: 0, postId: postAId }
      )
    ).toBe(false);
  });

  it("chooses the first conversation view from mode, unread, and bottom intent", () => {
    expect(
      createInitialConversationView({
        existingView: { kind: "post", offset: 4, postId: postAId },
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
          view: { kind: "post", offset: -6, postId: postAId },
        },
        preferBottom: false,
        unreadPostId: null,
      })
    ).toEqual({ kind: "post", offset: -6, postId: postAId });

    expect(
      createInitialConversationView({
        existingView: null,
        mode: { kind: "jump", postId: postBId },
        preferBottom: false,
        unreadPostId: null,
      })
    ).toEqual({ kind: "post", offset: 0, postId: postBId });

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
    ).toEqual({ kind: "post", offset: 0, postId: postAId });
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
        targetView: { kind: "post", offset: 0, postId: postAId },
      })
    ).toBe(true);

    expect(
      isConversationViewAtOrAfter({
        currentView: { kind: "post", offset: 8, postId: postBId },
        postIdToIndex,
        targetView: { kind: "post", offset: 4, postId: postAId },
      })
    ).toBe(true);

    expect(
      isConversationViewAtOrAfter({
        currentView: { kind: "post", offset: 2, postId: postAId },
        postIdToIndex,
        targetView: { kind: "post", offset: 4, postId: postAId },
      })
    ).toBe(false);

    expect(
      isConversationViewAtOrAfter({
        currentView: { kind: "post", offset: 0, postId: postAId },
        postIdToIndex,
        targetView: { kind: "bottom" },
      })
    ).toBe(false);

    expect(
      isConversationViewAtOrAfter({
        currentView: { kind: "post", offset: 0, postId: postAId },
        postIdToIndex: new Map(),
        targetView: { kind: "post", offset: 0, postId: postAId },
      })
    ).toBe(false);
  });
});
