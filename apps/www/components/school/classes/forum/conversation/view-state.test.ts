import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  captureConversationView,
  createForumConversationMode,
  createInitialConversationAnchor,
  createInitialConversationView,
} from "@/components/school/classes/forum/conversation/view-state";
import type { ForumConversationView } from "@/lib/store/forum";

const postAId = "post_a" as Id<"schoolClassForumPosts">;
const postBId = "post_b" as Id<"schoolClassForumPosts">;

function createItems(): VirtualItem[] {
  return [
    {
      type: "header",
      forum: {
        _id: "forum_1" as Id<"schoolClassForums">,
        title: "Forum",
      },
    } as VirtualItem,
    { type: "unread", count: 2 } as VirtualItem,
    {
      type: "post",
      isFirstInGroup: true,
      post: {
        _id: postAId,
        body: "A",
      },
    } as VirtualItem,
    {
      type: "post",
      isFirstInGroup: false,
      post: {
        _id: postBId,
        body: "B",
      },
    } as VirtualItem,
    { type: "spacer" } as VirtualItem,
  ];
}

function createHandle(overrides?: {
  distanceFromBottom?: number;
  findItemIndex?: number;
  offsets?: number[];
  scrollOffset?: number;
}) {
  const offsets = overrides?.offsets ?? [0, 40, 80, 140, 220];

  return {
    current: {
      findItemIndex: () => overrides?.findItemIndex ?? 1,
      getDistanceFromBottom: () => overrides?.distanceFromBottom ?? 120,
      getItemOffset: (index: number) => offsets[index] ?? 0,
      getScrollOffset: () => overrides?.scrollOffset ?? 90,
      isAtBottom: () => false,
      scrollToBottom: () => undefined,
      scrollToIndex: () => undefined,
    },
  };
}

describe("forum conversation view state", () => {
  it("falls back to live mode when no saved restore view exists", () => {
    expect(
      createForumConversationMode({
        restoreView: null,
      })
    ).toEqual({ kind: "live" });
  });

  it("uses restore mode when a saved post snapshot exists", () => {
    const restoreView = {
      kind: "post",
      offset: 14,
      postId: postAId,
    } satisfies ForumConversationView;

    expect(
      createForumConversationMode({
        restoreView,
      })
    ).toEqual({ kind: "restore", postId: postAId, view: restoreView });
  });

  it("restores the saved anchor before falling back to unread", () => {
    const restoreView = {
      kind: "post",
      offset: 18,
      postId: postBId,
    } satisfies ForumConversationView;

    expect(
      createInitialConversationAnchor({
        existingView: restoreView,
        mode: { kind: "restore", postId: postBId, view: restoreView },
        postIdToIndex: new Map([
          [postAId, 2],
          [postBId, 3],
        ]),
        unreadIndex: 1,
      })
    ).toEqual({
      kind: "index",
      index: 3,
      align: "start",
      offset: 18,
    });
  });

  it("centers a jump target and falls back to bottom when the target is missing", () => {
    expect(
      createInitialConversationAnchor({
        existingView: null,
        mode: { kind: "jump", postId: postAId },
        postIdToIndex: new Map([[postAId, 2]]),
        unreadIndex: null,
      })
    ).toEqual({
      kind: "index",
      index: 2,
      align: "center",
    });

    expect(
      createInitialConversationAnchor({
        existingView: null,
        mode: { kind: "jump", postId: postAId },
        postIdToIndex: new Map(),
        unreadIndex: 1,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("keeps bottom snapshots ahead of unread and falls back to bottom without unread", () => {
    expect(
      createInitialConversationAnchor({
        existingView: { kind: "bottom" },
        mode: { kind: "live" },
        postIdToIndex: new Map(),
        unreadIndex: 1,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationAnchor({
        existingView: null,
        mode: { kind: "live" },
        postIdToIndex: new Map(),
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("anchors live mode to the unread separator when no bottom snapshot exists", () => {
    expect(
      createInitialConversationAnchor({
        existingView: null,
        mode: { kind: "live" },
        postIdToIndex: new Map(),
        unreadIndex: 1,
      })
    ).toEqual({
      kind: "index",
      index: 1,
      align: "center",
    });
  });

  it("creates the first unread snapshot when no saved view exists", () => {
    const items = createItems();

    expect(
      createInitialConversationView({
        existingView: null,
        items,
        mode: { kind: "live" },
        unreadIndex: 1,
      })
    ).toEqual({
      kind: "post",
      offset: 0,
      postId: postAId,
    });
  });

  it("preserves restore, jump, and bottom snapshots on fresh mounts", () => {
    const restoreView = {
      kind: "post",
      offset: 6,
      postId: postBId,
    } satisfies ForumConversationView;

    expect(
      createInitialConversationView({
        existingView: null,
        items: createItems(),
        mode: { kind: "restore", postId: postBId, view: restoreView },
        unreadIndex: 1,
      })
    ).toEqual(restoreView);

    expect(
      createInitialConversationView({
        existingView: null,
        items: createItems(),
        mode: { kind: "jump", postId: postAId },
        unreadIndex: 1,
      })
    ).toEqual({ kind: "post", offset: 0, postId: postAId });

    expect(
      createInitialConversationView({
        existingView: { kind: "bottom" },
        items: createItems(),
        mode: { kind: "live" },
        unreadIndex: 1,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("falls back to bottom when unread markers do not resolve to a post", () => {
    expect(
      createInitialConversationView({
        existingView: null,
        items: [
          { type: "header", forum: {} } as VirtualItem,
          { type: "spacer" },
        ],
        mode: { kind: "live" },
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationView({
        existingView: null,
        items: [
          { type: "header", forum: {} } as VirtualItem,
          { type: "spacer" },
        ],
        mode: { kind: "live" },
        unreadIndex: 0,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("captures bottom snapshots with the shared bottom threshold", () => {
    expect(
      captureConversationView({
        items: createItems(),
        scrollRef: createHandle({ distanceFromBottom: 20 }),
      })
    ).toEqual({ kind: "bottom" });
  });

  it("returns null when the viewport handle or measured items are unavailable", () => {
    expect(
      captureConversationView({
        items: createItems(),
        scrollRef: { current: null },
      })
    ).toBeNull();

    expect(
      captureConversationView({
        items: [],
        scrollRef: createHandle(),
      })
    ).toBeNull();
  });

  it("captures the first visible post even when separators occupy the top edge", () => {
    expect(
      captureConversationView({
        items: createItems(),
        offset: 90,
        scrollRef: createHandle({
          findItemIndex: 1,
          offsets: [0, 40, 80, 140, 220],
          scrollOffset: 90,
        }),
      })
    ).toEqual({
      kind: "post",
      offset: 10,
      postId: postAId,
    });
  });

  it("walks backward when the visible edge sits below the final post", () => {
    expect(
      captureConversationView({
        items: createItems(),
        offset: 230,
        scrollRef: createHandle({
          findItemIndex: 4,
          offsets: [0, 40, 80, 140, 220],
          scrollOffset: 230,
        }),
      })
    ).toEqual({
      kind: "post",
      offset: 90,
      postId: postBId,
    });
  });

  it("walks backward through measured offsets before choosing the first visible post", () => {
    expect(
      captureConversationView({
        items: createItems(),
        offset: 85,
        scrollRef: createHandle({
          findItemIndex: 4,
          offsets: [0, 40, 80, 140, 220],
          scrollOffset: 85,
        }),
      })
    ).toEqual({
      kind: "post",
      offset: 5,
      postId: postAId,
    });
  });

  it("returns null when no rendered post can anchor the viewport", () => {
    expect(
      captureConversationView({
        items: [
          { type: "header", forum: {} } as VirtualItem,
          { type: "spacer" },
        ],
        offset: 50,
        scrollRef: createHandle({
          findItemIndex: 1,
          offsets: [0, 40],
          scrollOffset: 50,
        }),
      })
    ).toBeNull();
  });
});
