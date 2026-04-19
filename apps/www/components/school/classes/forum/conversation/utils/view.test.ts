import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import {
  areConversationViewsEqual,
  captureConversationView,
  createForumConversationMode,
  createInitialConversationAnchor,
  createInitialConversationView,
  createRestoreConversationAnchor,
  isConversationViewAtOrAfter,
} from "@/components/school/classes/forum/conversation/utils/view";
import type { ForumConversationView } from "@/lib/store/forum";

const headerPostId = "post_header" as Id<"schoolClassForumPosts">;
const postAId = "post_a" as Id<"schoolClassForumPosts">;
const postBId = "post_b" as Id<"schoolClassForumPosts">;
const dateKey = 1_744_775_200_000;

function createItems(): VirtualItem[] {
  return [
    {
      type: "header",
      forum: {
        _id: "forum_1" as Id<"schoolClassForums">,
        title: "Forum",
      },
    } as VirtualItem,
    { type: "date", date: dateKey } as VirtualItem,
    { type: "unread", count: 2 } as VirtualItem,
    {
      type: "post",
      isFirstInGroup: true,
      post: {
        _id: headerPostId,
        body: "Header post",
      },
    } as VirtualItem,
    {
      type: "post",
      isFirstInGroup: false,
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
  ];
}

function createLookup() {
  return {
    dateToIndex: new Map([[dateKey, 1]]),
    headerIndex: 0,
    postIdToIndex: new Map([
      [headerPostId, 3],
      [postAId, 4],
      [postBId, 5],
    ]),
    unreadIndex: 2,
  };
}

function createHandle(overrides?: {
  distanceFromBottom?: number;
  findItemIndex?: number;
  isAtBottom?: boolean;
  offsets?: number[];
  scrollOffset?: number;
}) {
  const offsets = overrides?.offsets ?? [0, 80, 120, 160, 240, 320];

  return {
    current: {
      findItemIndex: () => overrides?.findItemIndex ?? 0,
      getDistanceFromBottom: () => overrides?.distanceFromBottom ?? 200,
      getItemOffset: (index: number) => offsets[index] ?? 0,
      getScrollOffset: () => overrides?.scrollOffset ?? 0,
      getViewportSize: () => 400,
      isAtBottom: () => overrides?.isAtBottom ?? false,
      scrollToBottom: () => undefined,
      scrollToIndex: () => undefined,
    },
  };
}

describe("forum conversation view state", () => {
  it("falls back to live mode when no saved restore view exists", () => {
    expect(createForumConversationMode({ restoreView: null })).toEqual({
      kind: "live",
    });
  });

  it("uses restore mode for any saved semantic view", () => {
    const headerView = {
      kind: "header",
      offset: 12,
      postId: headerPostId,
    } satisfies ForumConversationView;

    const unreadView = {
      kind: "unread",
      offset: 4,
      postId: headerPostId,
    } satisfies ForumConversationView;

    expect(createForumConversationMode({ restoreView: headerView })).toEqual({
      kind: "restore",
      postId: headerPostId,
      view: headerView,
    });

    expect(createForumConversationMode({ restoreView: unreadView })).toEqual({
      kind: "restore",
      postId: headerPostId,
      view: unreadView,
    });
  });

  it("compares conversation views by semantic value", () => {
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
        { kind: "date", date: dateKey, offset: 4, postId: postAId },
        { kind: "date", date: dateKey, offset: 5, postId: postAId }
      )
    ).toBe(false);
  });

  it("compares semantic viewport order for back-history expiry", () => {
    const lookup = createLookup();

    expect(
      isConversationViewAtOrAfter({
        ...lookup,
        currentView: { kind: "bottom" },
        targetView: { kind: "post", offset: 4, postId: postAId },
      })
    ).toBe(true);

    expect(
      isConversationViewAtOrAfter({
        ...lookup,
        currentView: { kind: "post", offset: 8, postId: postBId },
        targetView: { kind: "post", offset: 4, postId: postAId },
      })
    ).toBe(true);

    expect(
      isConversationViewAtOrAfter({
        ...lookup,
        currentView: { kind: "post", offset: 2, postId: postAId },
        targetView: { kind: "post", offset: 4, postId: postAId },
      })
    ).toBe(false);

    expect(
      isConversationViewAtOrAfter({
        ...lookup,
        currentView: { kind: "post", offset: 4, postId: postAId },
        targetView: { kind: "bottom" },
      })
    ).toBe(false);

    expect(
      isConversationViewAtOrAfter({
        dateToIndex: new Map(),
        currentView: { kind: "post", offset: 4, postId: postAId },
        headerIndex: null,
        postIdToIndex: new Map(),
        targetView: { kind: "post", offset: 4, postId: postAId },
        unreadIndex: null,
      })
    ).toBe(false);
  });

  it("creates exact restore anchors from saved semantic views", () => {
    expect(
      createRestoreConversationAnchor({
        ...createLookup(),
        view: { kind: "post", offset: 6, postId: postAId },
      })
    ).toEqual({ kind: "index", index: 4, align: "start", offset: 6 });

    expect(
      createRestoreConversationAnchor({
        dateToIndex: new Map(),
        headerIndex: null,
        postIdToIndex: new Map(),
        unreadIndex: null,
        view: { kind: "post", offset: 6, postId: postAId },
      })
    ).toBeNull();
  });

  it("resolves restore anchors for header, date, unread, and post views", () => {
    const lookup = createLookup();

    expect(
      createInitialConversationAnchor({
        ...lookup,
        existingView: null,
        mode: {
          kind: "restore",
          postId: headerPostId,
          view: { kind: "header", offset: 14, postId: headerPostId },
        },
      })
    ).toEqual({ kind: "index", index: 0, align: "start", offset: 14 });

    expect(
      createInitialConversationAnchor({
        ...lookup,
        existingView: null,
        mode: {
          kind: "restore",
          postId: headerPostId,
          view: {
            kind: "date",
            date: dateKey,
            offset: 10,
            postId: headerPostId,
          },
        },
      })
    ).toEqual({ kind: "index", index: 1, align: "start", offset: 10 });

    expect(
      createInitialConversationAnchor({
        ...lookup,
        existingView: null,
        mode: {
          kind: "restore",
          postId: headerPostId,
          view: { kind: "unread", offset: 8, postId: headerPostId },
        },
      })
    ).toEqual({ kind: "index", index: 2, align: "start", offset: 8 });

    expect(
      createInitialConversationAnchor({
        ...lookup,
        existingView: null,
        mode: {
          kind: "restore",
          postId: postAId,
          view: { kind: "post", offset: 6, postId: postAId },
        },
      })
    ).toEqual({ kind: "index", index: 4, align: "start", offset: 6 });
  });

  it("falls back from missing semantic separators to the associated post or bottom", () => {
    expect(
      createInitialConversationAnchor({
        dateToIndex: new Map(),
        existingView: null,
        headerIndex: null,
        mode: {
          kind: "restore",
          postId: headerPostId,
          view: {
            kind: "date",
            date: dateKey,
            offset: 3,
            postId: headerPostId,
          },
        },
        postIdToIndex: new Map([[headerPostId, 7]]),
        unreadIndex: null,
      })
    ).toEqual({ kind: "index", index: 7, align: "start", offset: 3 });

    expect(
      createInitialConversationAnchor({
        dateToIndex: new Map(),
        existingView: null,
        headerIndex: null,
        mode: {
          kind: "restore",
          postId: headerPostId,
          view: { kind: "header", offset: 3, postId: headerPostId },
        },
        postIdToIndex: new Map(),
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationAnchor({
        dateToIndex: new Map(),
        existingView: null,
        headerIndex: null,
        mode: {
          kind: "restore",
          postId: headerPostId,
          view: {
            kind: "date",
            date: dateKey,
            offset: 5,
            postId: headerPostId,
          },
        },
        postIdToIndex: new Map(),
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationAnchor({
        dateToIndex: new Map(),
        existingView: null,
        headerIndex: null,
        mode: {
          kind: "restore",
          postId: headerPostId,
          view: { kind: "unread", offset: 5, postId: headerPostId },
        },
        postIdToIndex: new Map(),
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationAnchor({
        dateToIndex: new Map(),
        existingView: null,
        headerIndex: null,
        mode: {
          kind: "restore",
          postId: headerPostId,
          view: { kind: "post", offset: 5, postId: headerPostId },
        },
        postIdToIndex: new Map(),
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("centers jump targets and keeps live bottom/unread fallbacks", () => {
    const lookup = createLookup();

    expect(
      createInitialConversationAnchor({
        ...lookup,
        existingView: null,
        mode: { kind: "jump", postId: postAId },
      })
    ).toEqual({ kind: "index", index: 4, align: "center" });

    expect(
      createInitialConversationAnchor({
        dateToIndex: new Map(),
        existingView: null,
        headerIndex: null,
        mode: { kind: "jump", postId: postAId },
        postIdToIndex: new Map(),
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationAnchor({
        ...lookup,
        existingView: { kind: "bottom" },
        mode: { kind: "live" },
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationAnchor({
        ...lookup,
        existingView: null,
        mode: { kind: "live" },
      })
    ).toEqual({ kind: "index", index: 2, align: "center" });

    expect(
      createInitialConversationAnchor({
        dateToIndex: new Map(),
        existingView: null,
        headerIndex: null,
        mode: { kind: "live" },
        postIdToIndex: new Map(),
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("creates fallback snapshots for restore, jump, bottom, and unread openings", () => {
    const restoreView = {
      kind: "date",
      date: dateKey,
      offset: 7,
      postId: headerPostId,
    } satisfies ForumConversationView;

    expect(
      createInitialConversationView({
        existingView: null,
        items: createItems(),
        mode: { kind: "restore", postId: headerPostId, view: restoreView },
        unreadIndex: 2,
      })
    ).toEqual(restoreView);

    expect(
      createInitialConversationView({
        existingView: null,
        items: createItems(),
        mode: { kind: "jump", postId: postAId },
        unreadIndex: 2,
      })
    ).toEqual({ kind: "post", offset: 0, postId: postAId });

    expect(
      createInitialConversationView({
        existingView: { kind: "bottom" },
        items: createItems(),
        mode: { kind: "live" },
        unreadIndex: 2,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationView({
        existingView: null,
        items: createItems(),
        mode: { kind: "live" },
        unreadIndex: 2,
      })
    ).toEqual({ kind: "unread", offset: 0, postId: headerPostId });
  });

  it("falls back to bottom when unread markers cannot resolve to a post", () => {
    expect(
      createInitialConversationView({
        existingView: null,
        items: [{ type: "header", forum: {} } as VirtualItem],
        mode: { kind: "live" },
        unreadIndex: 0,
      })
    ).toEqual({ kind: "bottom" });

    expect(
      createInitialConversationView({
        existingView: null,
        items: createItems(),
        mode: { kind: "live" },
        unreadIndex: null,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("captures bottom snapshots only when exact bottom is confirmed", () => {
    expect(
      captureConversationView({
        items: createItems(),
        offset: 330,
        scrollRef: createHandle({
          distanceFromBottom: 20,
          findItemIndex: 5,
          isAtBottom: false,
          scrollOffset: 330,
        }),
      })
    ).toEqual({ kind: "post", offset: 10, postId: postBId });

    expect(
      captureConversationView({
        items: createItems(),
        scrollRef: createHandle({ distanceFromBottom: 20, isAtBottom: true }),
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

  it("captures semantic top-edge items for header, date, unread, and post", () => {
    const items = createItems();

    expect(
      captureConversationView({
        items,
        offset: 10,
        scrollRef: createHandle({
          findItemIndex: 0,
          offsets: [0, 80, 120, 160, 240, 320],
          scrollOffset: 10,
        }),
      })
    ).toEqual({ kind: "header", offset: 10, postId: headerPostId });

    expect(
      captureConversationView({
        items,
        offset: 90,
        scrollRef: createHandle({
          findItemIndex: 1,
          offsets: [0, 80, 120, 160, 240, 320],
          scrollOffset: 90,
        }),
      })
    ).toEqual({
      kind: "date",
      date: dateKey,
      offset: 10,
      postId: headerPostId,
    });

    expect(
      captureConversationView({
        items,
        offset: 130,
        scrollRef: createHandle({
          findItemIndex: 2,
          offsets: [0, 80, 120, 160, 240, 320],
          scrollOffset: 130,
        }),
      })
    ).toEqual({ kind: "unread", offset: 10, postId: headerPostId });

    expect(
      captureConversationView({
        items,
        offset: 170,
        scrollRef: createHandle({
          findItemIndex: 3,
          offsets: [0, 80, 120, 160, 240, 320],
          scrollOffset: 170,
        }),
      })
    ).toEqual({ kind: "post", offset: 10, postId: headerPostId });
  });

  it("repositions the measured visible index when the virtualizer start index is stale", () => {
    const items = createItems();

    expect(
      captureConversationView({
        items,
        offset: 90,
        scrollRef: createHandle({
          findItemIndex: 3,
          offsets: [0, 80, 120, 160, 240, 320],
          scrollOffset: 90,
        }),
      })
    ).toEqual({
      kind: "date",
      date: dateKey,
      offset: 10,
      postId: headerPostId,
    });

    expect(
      captureConversationView({
        items,
        offset: 170,
        scrollRef: createHandle({
          findItemIndex: 0,
          offsets: [0, 80, 120, 160, 240, 320],
          scrollOffset: 170,
        }),
      })
    ).toEqual({ kind: "post", offset: 10, postId: headerPostId });
  });

  it("falls backward from trailing viewport positions to the last restorable item", () => {
    const items = createItems();

    expect(
      captureConversationView({
        items,
        offset: 330,
        scrollRef: createHandle({
          findItemIndex: 5,
          offsets: [0, 80, 120, 160, 240, 320],
          scrollOffset: 330,
        }),
      })
    ).toEqual({ kind: "post", offset: 10, postId: postBId });

    expect(
      captureConversationView({
        items: [{ type: "header", forum: {} } as VirtualItem],
        offset: 20,
        scrollRef: createHandle({
          findItemIndex: 0,
          offsets: [0],
          scrollOffset: 20,
        }),
      })
    ).toEqual({ kind: "header", offset: 20, postId: null });
  });

  it("falls backward when forward scanning only sees non-restorable items", () => {
    expect(
      captureConversationView({
        items: [
          { type: "header", forum: {} } as VirtualItem,
          { type: "date", date: dateKey } as VirtualItem,
        ],
        offset: 90,
        scrollRef: createHandle({
          findItemIndex: 1,
          offsets: [0, 80],
          scrollOffset: 90,
        }),
      })
    ).toEqual({ kind: "header", offset: 90, postId: null });
  });

  it("returns null when only non-restorable separator items remain around the viewport", () => {
    expect(
      captureConversationView({
        items: [{ type: "date", date: dateKey } as VirtualItem],
        offset: 120,
        scrollRef: createHandle({
          findItemIndex: 0,
          offsets: [0],
          scrollOffset: 120,
        }),
      })
    ).toBeNull();

    expect(
      captureConversationView({
        items: [{ type: "unread", count: 1 } as VirtualItem],
        offset: 120,
        scrollRef: createHandle({
          findItemIndex: 0,
          offsets: [0],
          scrollOffset: 120,
        }),
      })
    ).toBeNull();

    expect(
      captureConversationView({
        items: [
          { type: "date", date: dateKey } as VirtualItem,
          { type: "unread", count: 1 } as VirtualItem,
        ],
        offset: 120,
        scrollRef: createHandle({
          findItemIndex: 1,
          offsets: [0, 80],
          scrollOffset: 120,
        }),
      })
    ).toBeNull();

    const sparseItems = new Array(1) as VirtualItem[];

    expect(
      captureConversationView({
        items: sparseItems,
        offset: 10,
        scrollRef: createHandle({
          findItemIndex: 0,
          offsets: [0],
          scrollOffset: 10,
        }),
      })
    ).toBeNull();

    expect(
      captureConversationView({
        items: [{ type: "unknown" } as unknown as VirtualItem],
        offset: 10,
        scrollRef: createHandle({
          findItemIndex: 0,
          offsets: [0],
          scrollOffset: 10,
        }),
      })
    ).toBeNull();
  });
});
