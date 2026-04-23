import { describe, expect, it } from "vitest";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/pages";
import {
  captureConversationView,
  getCenteredConversationPostId,
  getConversationBottomDistance,
  getFirstVisibleConversationPostId,
  getLastVisibleConversationPostId,
  hasConversationViewReached,
  hasConversationViewSettledPlacement,
  isConversationViewCentered,
  isConversationViewVisible,
} from "@/components/school/classes/forum/conversation/data/settled-view";
import {
  createConversationTestFindItemIndex,
  createConversationTestHandle,
  createConversationTestPost,
} from "@/components/school/classes/forum/conversation/helpers/test";

const firstPost = createConversationTestPost({
  postId: "post_1",
  sequence: 1,
});
const secondPost = createConversationTestPost({
  postId: "post_2",
  sequence: 2,
});
const rows = [
  { type: "header" },
  { type: "date", value: firstPost._creationTime },
  { post: firstPost, type: "post" },
  { count: 2, postId: secondPost._id, status: "new", type: "unread" },
  { post: secondPost, type: "post" },
] satisfies ConversationRow[];
const rowIndexByPostId = new Map([
  [firstPost._id, 2],
  [secondPost._id, 4],
]);

function createHandle({
  offsets,
  getItemOffset = (index: number) => index * 100,
  getItemSize = () => 100,
  scrollOffset,
  scrollSize = rows.length * 100,
  viewportSize = 200,
}: {
  offsets?: readonly number[];
  getItemOffset?: (index: number) => number;
  getItemSize?: (index: number) => number;
  scrollOffset: number;
  scrollSize?: number;
  viewportSize?: number;
}) {
  return createConversationTestHandle({
    findItemIndex: createConversationTestFindItemIndex(
      offsets ?? rows.map((_, index) => index * 100)
    ),
    getItemOffset,
    getItemSize,
    scrollOffset,
    scrollSize,
    viewportSize,
  }).handle;
}

describe("conversation/data/settled-view", () => {
  it("returns the current virtual bottom distance", () => {
    expect(
      getConversationBottomDistance(
        createHandle({
          scrollOffset: 300,
        })
      )
    ).toBe(0);

    expect(
      getConversationBottomDistance(
        createHandle({
          scrollOffset: 288,
        })
      )
    ).toBe(12);
  });

  it("captures bottom when the transcript is already settled at the latest edge", () => {
    expect(
      captureConversationView({
        handle: createHandle({
          scrollOffset: 300,
        }),
        rows,
      })
    ).toEqual({ kind: "bottom" });
  });

  it("captures the visible post closest to the viewport center", () => {
    const handle = createHandle({
      offsets: [0, 60, 120, 150, 170],
      getItemOffset: (index) => [0, 60, 120, 150, 170][index] ?? index * 100,
      getItemSize: (index) => [60, 60, 30, 20, 120][index] ?? 100,
      scrollOffset: 80,
    });

    expect(
      captureConversationView({
        handle,
        rows,
      })
    ).toEqual({
      kind: "post",
      postId: secondPost._id,
    });
    expect(
      getCenteredConversationPostId({
        handle,
        rows,
      })
    ).toBe(secondPost._id);
    expect(
      getFirstVisibleConversationPostId({
        handle,
        rows,
      })
    ).toBe(firstPost._id);
    expect(
      getLastVisibleConversationPostId({
        handle,
        rows,
      })
    ).toBe(secondPost._id);
  });

  it("keeps the closest visible post when a later candidate is farther away", () => {
    const handle = createHandle({
      offsets: [0, 60, 120, 180, 240],
      getItemOffset: (index) => [0, 60, 120, 180, 240][index] ?? index * 100,
      getItemSize: (index) => [60, 60, 80, 40, 60][index] ?? 100,
      scrollOffset: 100,
    });

    expect(
      getCenteredConversationPostId({
        handle,
        rows,
      })
    ).toBe(firstPost._id);
  });

  it("chooses the visible post below the center line when it is closer", () => {
    const handle = createHandle({
      offsets: [0, 60, 80, 120, 170],
      getItemOffset: (index) => [0, 60, 80, 120, 170][index] ?? index * 100,
      getItemSize: (index) => [60, 20, 40, 40, 40][index] ?? 100,
      scrollOffset: 100,
      viewportSize: 100,
    });

    expect(
      getCenteredConversationPostId({
        handle,
        rows,
      })
    ).toBe(secondPost._id);
  });

  it("returns null when no visible post row exists in the current range", () => {
    const handle = createHandle({
      scrollOffset: 0,
      viewportSize: 90,
    });

    expect(
      captureConversationView({
        handle,
        rows: rows.slice(0, 2),
      })
    ).toBeNull();
    expect(
      getFirstVisibleConversationPostId({
        handle,
        rows: rows.slice(0, 2),
      })
    ).toBeNull();
    expect(
      getLastVisibleConversationPostId({
        handle,
        rows: rows.slice(0, 2),
      })
    ).toBeNull();
    expect(
      getLastVisibleConversationPostId({
        handle: createHandle({
          scrollOffset: 0,
          viewportSize: 0,
        }),
        rows,
      })
    ).toBeNull();
    expect(
      getCenteredConversationPostId({
        handle: createHandle({
          scrollOffset: 0,
          viewportSize: 0,
        }),
        rows,
      })
    ).toBeNull();
    expect(
      getFirstVisibleConversationPostId({
        handle: createHandle({
          scrollOffset: 0,
        }),
        rows: [],
      })
    ).toBeNull();
  });

  it("skips invisible trailing rows when resolving the last visible post", () => {
    expect(
      getLastVisibleConversationPostId({
        handle: createHandle({
          offsets: [0, 100, 200, 260, 350],
          getItemOffset: (index) =>
            [0, 100, 200, 260, 350][index] ?? index * 100,
          getItemSize: (index) => [100, 100, 60, 90, 100][index] ?? 100,
          scrollOffset: 100,
          viewportSize: 250,
          scrollSize: 450,
        }),
        rows,
      })
    ).toBe(firstPost._id);
  });

  it("skips invisible leading rows when resolving the first visible post", () => {
    expect(
      getFirstVisibleConversationPostId({
        handle: createHandle({
          offsets: [0, 100, 200, 260, 350],
          getItemOffset: (index) =>
            [0, 100, 200, 260, 350][index] ?? index * 100,
          getItemSize: (index) => [100, 50, 60, 90, 100][index] ?? 100,
          scrollOffset: 150,
          viewportSize: 250,
          scrollSize: 450,
        }),
        rows,
      })
    ).toBe(firstPost._id);
  });

  it("treats a post target as reached once it becomes visible or passes above the viewport", () => {
    expect(
      hasConversationViewReached({
        handle: createHandle({
          scrollOffset: 90,
        }),
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);

    expect(
      hasConversationViewReached({
        handle: createHandle({
          scrollOffset: 350,
        }),
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
  });

  it("returns false when the target post is unknown or still below the viewport", () => {
    expect(
      hasConversationViewReached({
        handle: createHandle({
          scrollOffset: 0,
        }),
        rowIndexByPostId: new Map(),
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);

    expect(
      hasConversationViewReached({
        handle: createHandle({
          scrollOffset: 0,
        }),
        rowIndexByPostId,
        view: { kind: "post", postId: secondPost._id },
      })
    ).toBe(false);

    expect(
      hasConversationViewReached({
        handle: createHandle({
          scrollOffset: 120,
        }),
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(false);
  });

  it("treats a clipped post as visible but not centered", () => {
    const handle = createHandle({
      offsets: [0, 100, 120, 220, 320],
      getItemOffset: (index) => [0, 100, 120, 220, 320][index] ?? index * 100,
      getItemSize: (index) => [100, 20, 120, 100, 100][index] ?? 100,
      scrollOffset: 100,
      viewportSize: 300,
    });

    expect(
      isConversationViewVisible({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      isConversationViewCentered({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);
  });

  it("treats a well-positioned post as centered and settled", () => {
    const handle = createHandle({
      offsets: [0, 100, 180, 300, 360],
      getItemOffset: (index) => [0, 100, 180, 300, 360][index] ?? index * 100,
      getItemSize: (index) => [100, 80, 120, 60, 100][index] ?? 100,
      scrollOffset: 80,
      viewportSize: 320,
    });

    expect(
      isConversationViewCentered({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        handle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
  });

  it("treats top-clamped and bottom-clamped targets as settled when true centering is impossible", () => {
    const topClampedHandle = createHandle({
      offsets: [0, 10, 20, 140, 240],
      getItemOffset: (index) => [0, 10, 20, 140, 240][index] ?? index * 100,
      getItemSize: (index) => [10, 10, 100, 100, 100][index] ?? 100,
      scrollOffset: 0,
      scrollSize: 340,
    });
    const bottomClampedHandle = createHandle({
      offsets: [0, 100, 200, 300, 390],
      getItemOffset: (index) => [0, 100, 200, 300, 390][index] ?? index * 100,
      getItemSize: (index) => [100, 100, 100, 80, 100][index] ?? 100,
      scrollOffset: 300,
      scrollSize: 490,
    });

    expect(
      hasConversationViewSettledPlacement({
        handle: topClampedHandle,
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        handle: bottomClampedHandle,
        rowIndexByPostId,
        view: { kind: "post", postId: secondPost._id },
      })
    ).toBe(true);
  });

  it("returns false for offscreen or unknown post placements", () => {
    expect(
      hasConversationViewSettledPlacement({
        handle: createHandle({
          scrollOffset: 0,
        }),
        rowIndexByPostId: new Map(),
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);

    expect(
      hasConversationViewSettledPlacement({
        handle: createHandle({
          scrollOffset: 0,
          viewportSize: 80,
        }),
        rowIndexByPostId,
        view: { kind: "post", postId: secondPost._id },
      })
    ).toBe(false);
  });

  it("returns false for a visible post that is still off-center in the middle of the transcript", () => {
    expect(
      hasConversationViewSettledPlacement({
        handle: createHandle({
          offsets: [0, 100, 140, 260, 360],
          getItemOffset: (index) =>
            [0, 100, 140, 260, 360][index] ?? index * 100,
          getItemSize: (index) => [100, 40, 60, 80, 100][index] ?? 100,
          scrollOffset: 100,
          viewportSize: 220,
        }),
        rowIndexByPostId,
        view: { kind: "post", postId: firstPost._id },
      })
    ).toBe(false);
  });

  it("treats a bottom view as visible, centered, and settled when the latest edge is reached", () => {
    const handle = createHandle({
      scrollOffset: 300,
    });

    expect(
      isConversationViewVisible({
        handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(
      isConversationViewCentered({
        handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(true);
    expect(
      hasConversationViewSettledPlacement({
        handle,
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(true);
  });

  it("does not treat a bottom view as settled before the latest edge is reached", () => {
    expect(
      hasConversationViewSettledPlacement({
        handle: createHandle({
          scrollOffset: 120,
        }),
        rowIndexByPostId,
        view: { kind: "bottom" },
      })
    ).toBe(false);
  });
});
