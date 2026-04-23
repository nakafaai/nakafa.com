import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import type { VirtualizerHandle } from "virtua";
import { describe, expect, it, vi } from "vitest";
import { createConversationScrollController } from "@/components/school/classes/forum/conversation/data/transcript-scroll";

const postId = "post_1" as Id<"schoolClassForumPosts">;

function setRect(
  element: Element,
  { bottom, top }: { bottom: number; top: number }
) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom,
      height: bottom - top,
      left: 0,
      right: 0,
      top,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => undefined,
    }),
  });
}

function setScrollMetrics(
  element: HTMLElement,
  {
    clientHeight,
    scrollHeight,
    scrollTop,
  }: {
    clientHeight: number;
    scrollHeight: number;
    scrollTop: number;
  }
) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    value: scrollTop,
    writable: true,
  });
}

function createRoot({
  clientHeight = 400,
  scrollHeight = 3000,
  scrollTop = 200,
  top = 0,
}: {
  clientHeight?: number;
  scrollHeight?: number;
  scrollTop?: number;
  top?: number;
} = {}) {
  const root = document.createElement("div");

  setRect(root, {
    top,
    bottom: top + clientHeight,
  });
  setScrollMetrics(root, {
    clientHeight,
    scrollHeight,
    scrollTop,
  });

  return root;
}

function appendPost(
  root: HTMLElement,
  {
    id = postId,
    bottom,
    top,
  }: {
    id?: Id<"schoolClassForumPosts">;
    bottom: number;
    top: number;
  }
) {
  const element = document.createElement("div");

  element.dataset.postId = id;
  setRect(element, { bottom, top });
  root.append(element);

  return element;
}

function createHandle({
  findItemIndex = (offset: number) => Math.min(9, Math.floor(offset / 100)),
  getItemOffset = (index: number) => index * 100,
  getItemSize = () => 100,
  scrollOffset,
  scrollSize = 3000,
  viewportSize = 400,
}: {
  findItemIndex?: (offset: number) => number;
  getItemOffset?: (index: number) => number;
  getItemSize?: (index: number) => number;
  scrollOffset: number;
  scrollSize?: number;
  viewportSize?: number;
}) {
  const scrollToIndex = vi.fn();

  const handle = {
    cache: {} as VirtualizerHandle["cache"],
    findItemIndex,
    getItemOffset,
    getItemSize,
    scrollBy: vi.fn(),
    scrollOffset,
    scrollSize,
    scrollTo: vi.fn(),
    scrollToIndex,
    viewportSize,
  } satisfies VirtualizerHandle;

  return {
    handle,
    scrollToIndex,
  };
}

function createController({
  handle = createHandle({ scrollOffset: 100 }).handle,
  lastRowIndex = 9,
  postIds = [postId],
  prefersReducedMotion = false,
  root = createRoot(),
  rowIndexByPostId = new Map([[postId, 3]]),
}: {
  handle?: VirtualizerHandle | null;
  lastRowIndex?: number | null;
  postIds?: Id<"schoolClassForumPosts">[];
  prefersReducedMotion?: boolean;
  root?: HTMLElement | null;
  rowIndexByPostId?: ReadonlyMap<Id<"schoolClassForumPosts">, number>;
} = {}) {
  return createConversationScrollController({
    lastRowIndex,
    postIds,
    prefersReducedMotion,
    rowIndexByPostId,
    scrollRootRef: {
      current: root,
    } satisfies RefObject<HTMLElement | null>,
    virtualizerRef: {
      current: handle,
    } satisfies RefObject<VirtualizerHandle | null>,
  });
}

describe("conversation/data/transcript-scroll", () => {
  it("captures null when the scroll root is unavailable", () => {
    const controller = createController({
      handle: null,
      root: null,
    });

    expect(controller.captureView()).toBeNull();
  });

  it("captures the current bottom view from the mounted transcript root", () => {
    const controller = createController({
      handle: null,
      root: createRoot({
        clientHeight: 200,
        scrollHeight: 200,
        scrollTop: 0,
      }),
    });

    expect(controller.captureView()).toEqual({
      kind: "bottom",
    });
  });

  it("returns false for reached checks when the scroll root is unavailable", () => {
    const controller = createController({
      handle: null,
      root: null,
    });

    expect(
      controller.isViewReached({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("treats the latest edge as reached for bottom views", () => {
    const controller = createController({
      handle: null,
      root: createRoot({
        clientHeight: 200,
        scrollHeight: 200,
        scrollTop: 0,
      }),
    });

    expect(
      controller.isViewReached({
        kind: "bottom",
      })
    ).toBe(true);
  });

  it("treats a mounted visible post as reached", () => {
    const root = createRoot();

    appendPost(root, {
      bottom: 180,
      top: 120,
    });

    const controller = createController({
      handle: null,
      root,
    });

    expect(
      controller.isViewReached({
        kind: "post",
        postId,
      })
    ).toBe(true);
  });

  it("treats an off-screen post above the viewport as reached once the virtual range has passed it", () => {
    const controller = createController({
      handle: createHandle({ scrollOffset: 500 }).handle,
      rowIndexByPostId: new Map([[postId, 2]]),
    });

    expect(
      controller.isViewReached({
        kind: "post",
        postId,
      })
    ).toBe(true);
  });

  it("returns false when a post is missing from both the DOM and the virtual index map", () => {
    const controller = createController({
      handle: createHandle({ scrollOffset: 100 }).handle,
      rowIndexByPostId: new Map(),
    });

    expect(
      controller.isViewReached({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("returns false for an off-screen post when no virtualizer handle is available", () => {
    const controller = createController({
      handle: null,
    });

    expect(
      controller.isViewReached({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("returns false when the virtual transcript has no rows yet", () => {
    const controller = createController({
      handle: createHandle({ scrollOffset: 100 }).handle,
      lastRowIndex: null,
    });

    expect(
      controller.isViewReached({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("returns false when the virtual list has no visible range yet", () => {
    const controller = createController({
      handle: createHandle({
        scrollOffset: 100,
        viewportSize: 0,
      }).handle,
    });

    expect(
      controller.isViewReached({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("returns false for settled checks when the scroll root is unavailable", () => {
    const controller = createController({
      handle: null,
      root: null,
    });

    expect(
      controller.isViewSettled({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("treats the latest edge as settled for bottom views", () => {
    const controller = createController({
      handle: null,
      root: createRoot({
        clientHeight: 200,
        scrollHeight: 200,
        scrollTop: 0,
      }),
    });

    expect(
      controller.isViewSettled({
        kind: "bottom",
      })
    ).toBe(true);
  });

  it("treats a mounted centered post as settled", () => {
    const root = createRoot();

    appendPost(root, {
      bottom: 260,
      top: 140,
    });

    const controller = createController({
      handle: null,
      root,
    });

    expect(
      controller.isViewSettled({
        kind: "post",
        postId,
      })
    ).toBe(true);
  });

  it("returns false for an off-screen post when no virtualizer handle is available", () => {
    const controller = createController({
      handle: null,
    });

    expect(
      controller.isViewSettled({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("returns false for settled checks when the target index is unknown", () => {
    const controller = createController({
      rowIndexByPostId: new Map(),
    });

    expect(
      controller.isViewSettled({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("returns false for settled checks when the virtualizer has no viewport yet", () => {
    const controller = createController({
      handle: createHandle({
        scrollOffset: 100,
        viewportSize: 0,
      }).handle,
    });

    expect(
      controller.isViewSettled({
        kind: "post",
        postId,
      })
    ).toBe(false);
  });

  it("treats a virtualized target near the viewport center as settled", () => {
    const controller = createController({
      handle: createHandle({
        getItemOffset: () => 300,
        getItemSize: () => 100,
        scrollOffset: 150,
      }).handle,
    });

    expect(
      controller.isViewSettled({
        kind: "post",
        postId,
      })
    ).toBe(true);
  });

  it("treats a top-clamped virtualized target as settled", () => {
    const controller = createController({
      handle: createHandle({
        getItemOffset: () => 0,
        scrollOffset: 0,
      }).handle,
      rowIndexByPostId: new Map([[postId, 0]]),
      root: createRoot({
        scrollTop: 0,
      }),
    });

    expect(
      controller.isViewSettled({
        kind: "post",
        postId,
      })
    ).toBe(true);
  });

  it("treats a bottom-clamped virtualized target as settled", () => {
    const controller = createController({
      handle: createHandle({
        getItemOffset: () => 900,
        scrollOffset: 200,
      }).handle,
      rowIndexByPostId: new Map([[postId, 9]]),
      root: createRoot({
        clientHeight: 400,
        scrollHeight: 1000,
        scrollTop: 600,
      }),
    });

    expect(
      controller.isViewSettled({
        kind: "post",
        postId,
      })
    ).toBe(true);
  });

  it("returns false when latest scrolling is requested without a virtualizer handle", () => {
    const controller = createController({
      handle: null,
    });

    expect(controller.scrollToLatest()).toBe(false);
  });

  it("returns false when latest scrolling is requested before any rows exist", () => {
    const controller = createController({
      lastRowIndex: null,
    });

    expect(controller.scrollToLatest()).toBe(false);
  });

  it("disables smooth latest scrolling when reduced motion is enabled", () => {
    const { handle, scrollToIndex } = createHandle({
      scrollOffset: 100,
    });
    const controller = createController({
      handle,
      prefersReducedMotion: true,
    });

    expect(controller.scrollToLatest()).toBe(true);
    expect(scrollToIndex).toHaveBeenCalledWith(9, {
      align: "end",
      smooth: false,
    });
  });

  it("returns false when post scrolling is requested without a virtualizer handle", () => {
    const controller = createController({
      handle: null,
    });

    expect(controller.scrollToPost(postId)).toBe(false);
  });

  it("returns false when post scrolling is requested for an unknown post", () => {
    const controller = createController({
      rowIndexByPostId: new Map(),
    });

    expect(controller.scrollToPost(postId)).toBe(false);
  });

  it("centers post jumps by default", () => {
    const { handle, scrollToIndex } = createHandle({
      scrollOffset: 100,
    });
    const controller = createController({
      handle,
    });

    expect(controller.scrollToPost(postId)).toBe(true);
    expect(scrollToIndex).toHaveBeenCalledWith(3, {
      align: "center",
      smooth: true,
    });
  });

  it("supports non-centered post placement when one caller asks for it", () => {
    const { handle, scrollToIndex } = createHandle({
      scrollOffset: 100,
    });
    const controller = createController({
      handle,
    });

    expect(
      controller.scrollToPost(postId, {
        align: "start",
        behavior: "auto",
      })
    ).toBe(true);
    expect(scrollToIndex).toHaveBeenCalledWith(3, {
      align: "start",
      smooth: false,
    });
  });
});
