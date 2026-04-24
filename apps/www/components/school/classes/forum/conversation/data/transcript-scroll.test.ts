import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type { ConversationRow } from "@/components/school/classes/forum/conversation/data/pages";
import { createConversationScrollController } from "@/components/school/classes/forum/conversation/data/transcript-scroll";
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
const rowIndexByPostId = new Map<Id<"schoolClassForumPosts">, number>([
  [firstPost._id, 2],
  [secondPost._id, 4],
]);

function createHandle({
  offsets = rows.map((_, index) => index * 100),
  getItemOffset = (index: number) => offsets[index] ?? index * 100,
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
    findItemIndex: createConversationTestFindItemIndex(offsets),
    getItemOffset,
    getItemSize,
    scrollOffset,
    scrollSize,
    viewportSize,
  });
}

function createController({
  handle = createHandle({
    scrollOffset: 100,
  }),
  prefersReducedMotion = false,
  rowsOverride = rows,
  rowIndexByPostIdOverride = rowIndexByPostId,
}: {
  handle?: ReturnType<typeof createConversationTestHandle> | null;
  prefersReducedMotion?: boolean;
  rowIndexByPostIdOverride?: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
  rowsOverride?: readonly ConversationRow[];
} = {}) {
  return createConversationScrollController({
    prefersReducedMotion,
    rowIndexByPostId: rowIndexByPostIdOverride,
    rows: rowsOverride,
    virtualizerRef: {
      current: handle?.handle ?? null,
    },
  });
}

describe("conversation/data/transcript-scroll", () => {
  it("captures null when no virtualizer handle is available", () => {
    expect(
      createController({
        handle: null,
      }).captureView()
    ).toBeNull();
  });

  it("captures the current bottom view from virtualizer metrics", () => {
    expect(
      createController({
        handle: createHandle({
          scrollOffset: 300,
        }),
      }).captureView()
    ).toEqual({ kind: "bottom" });
  });

  it("captures the centered visible post when detached from bottom", () => {
    const handle = createHandle({
      offsets: [0, 60, 120, 150, 170],
      getItemOffset: (index) => [0, 60, 120, 150, 170][index] ?? index * 100,
      getItemSize: (index) => [60, 60, 30, 20, 120][index] ?? 100,
      scrollOffset: 80,
      scrollSize: 400,
    });

    expect(
      createController({
        handle,
      }).captureView()
    ).toEqual({
      kind: "post",
      postId: secondPost._id,
    });
  });

  it("treats a visible or passed post as reached", () => {
    expect(
      createController().isViewReached({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(true);

    expect(
      createController({
        handle: createHandle({
          scrollOffset: 350,
        }),
      }).isViewReached({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(true);
  });

  it("returns false for reached checks when the handle or target is unavailable", () => {
    expect(
      createController({
        handle: null,
      }).isViewReached({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(false);

    expect(
      createController({
        rowIndexByPostIdOverride: new Map(),
      }).isViewReached({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(false);
  });

  it("treats a centered or edge-clamped post as settled", () => {
    expect(
      createController({
        handle: createHandle({
          offsets: [0, 100, 180, 300, 360],
          getItemOffset: (index) =>
            [0, 100, 180, 300, 360][index] ?? index * 100,
          getItemSize: (index) => [100, 80, 120, 60, 100][index] ?? 100,
          scrollOffset: 80,
          scrollSize: 460,
          viewportSize: 320,
        }),
      }).isViewSettled({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(true);

    expect(
      createController({
        handle: createHandle({
          offsets: [0, 10, 20, 140, 240],
          getItemOffset: (index) => [0, 10, 20, 140, 240][index] ?? index * 100,
          getItemSize: (index) => [10, 10, 100, 100, 100][index] ?? 100,
          scrollOffset: 0,
          scrollSize: 340,
        }),
      }).isViewSettled({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(true);

    expect(
      createController({
        handle: createHandle({
          offsets: [0, 100, 200, 300, 380],
          getItemOffset: (index) =>
            [0, 100, 200, 300, 380][index] ?? index * 100,
          getItemSize: (index) => [100, 100, 100, 80, 100][index] ?? 100,
          scrollOffset: 300,
          scrollSize: 480,
        }),
      }).isViewSettled({
        kind: "post",
        postId: secondPost._id,
      })
    ).toBe(true);
  });

  it("returns false for settled checks when the handle or target is unavailable", () => {
    expect(
      createController({
        handle: null,
      }).isViewSettled({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(false);

    expect(
      createController({
        rowIndexByPostIdOverride: new Map(),
      }).isViewSettled({
        kind: "post",
        postId: firstPost._id,
      })
    ).toBe(false);
  });

  it("treats bottom views as reached and settled when the latest edge is reached", () => {
    const controller = createController({
      handle: createHandle({
        scrollOffset: 300,
      }),
    });

    expect(
      controller.isViewReached({
        kind: "bottom",
      })
    ).toBe(true);
    expect(
      controller.isViewSettled({
        kind: "bottom",
      })
    ).toBe(true);
  });

  it("returns false when latest scrolling is requested without a handle or rows", () => {
    expect(
      createController({
        handle: null,
      }).scrollToLatest()
    ).toBe(false);

    expect(
      createController({
        rowsOverride: [],
      }).scrollToLatest()
    ).toBe(false);
  });

  it("disables smooth latest scrolling when reduced motion is enabled", () => {
    const handle = createHandle({
      scrollOffset: 100,
    });
    const controller = createController({
      handle,
      prefersReducedMotion: true,
    });

    expect(controller.scrollToLatest()).toBe(true);
    expect(handle.scrollToIndex).toHaveBeenCalledWith(rows.length - 1, {
      align: "end",
      smooth: false,
    });
  });

  it("returns false when post scrolling is requested without a handle or target index", () => {
    expect(
      createController({
        handle: null,
      }).scrollToPost(firstPost._id)
    ).toBe(false);

    expect(
      createController({
        rowIndexByPostIdOverride: new Map(),
      }).scrollToPost(firstPost._id)
    ).toBe(false);
  });

  it("centers post jumps by default and supports non-centered placement", () => {
    const handle = createHandle({
      scrollOffset: 100,
    });
    const controller = createController({
      handle,
    });

    expect(controller.scrollToPost(firstPost._id)).toBe(true);
    expect(handle.scrollToIndex).toHaveBeenCalledWith(2, {
      align: "center",
      smooth: true,
    });

    expect(
      controller.scrollToPost(firstPost._id, {
        align: "start",
        behavior: "auto",
      })
    ).toBe(true);
    expect(handle.scrollToIndex).toHaveBeenLastCalledWith(2, {
      align: "start",
      smooth: false,
    });

    expect(
      controller.scrollToPost(firstPost._id, {
        behavior: "instant",
      })
    ).toBe(true);
    expect(handle.scrollToIndex).toHaveBeenLastCalledWith(2, {
      align: "center",
      smooth: false,
    });
  });
});
