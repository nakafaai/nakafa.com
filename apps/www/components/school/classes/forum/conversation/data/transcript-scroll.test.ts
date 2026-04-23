import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { RefObject } from "react";
import type { VirtualizerHandle } from "virtua";
import { describe, expect, it, vi } from "vitest";
import { createConversationScrollController } from "@/components/school/classes/forum/conversation/data/transcript-scroll";

const postId = "post_1" as Id<"schoolClassForumPosts">;

function createRoot() {
  const root = document.createElement("div");

  Object.defineProperty(root, "clientHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(root, "scrollHeight", {
    configurable: true,
    value: 3000,
  });
  Object.defineProperty(root, "scrollTop", {
    configurable: true,
    value: 200,
    writable: true,
  });
  Object.defineProperty(root, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      bottom: 400,
      height: 400,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    }),
  });

  return root;
}

function createHandle({ scrollOffset }: { scrollOffset: number }) {
  const scrollToIndex = vi.fn();

  const handle = {
    cache: {} as VirtualizerHandle["cache"],
    findItemIndex: (offset: number) => Math.min(9, Math.floor(offset / 100)),
    getItemOffset: (index: number) => index * 100,
    getItemSize: () => 100,
    scrollBy: vi.fn(),
    scrollOffset,
    scrollSize: 3000,
    scrollTo: vi.fn(),
    scrollToIndex,
    viewportSize: 400,
  } satisfies VirtualizerHandle;

  return {
    handle,
    scrollToIndex,
  };
}

function createController({
  prefersReducedMotion = false,
  root = createRoot(),
  scrollOffset,
}: {
  prefersReducedMotion?: boolean;
  root?: HTMLElement;
  scrollOffset: number;
}) {
  const { handle, scrollToIndex } = createHandle({ scrollOffset });

  const controller = createConversationScrollController({
    lastRowIndex: 9,
    postIds: [postId],
    prefersReducedMotion,
    rowIndexByPostId: new Map([[postId, 3]]),
    scrollRootRef: {
      current: root,
    } satisfies RefObject<HTMLElement | null>,
    virtualizerRef: {
      current: handle,
    } satisfies RefObject<VirtualizerHandle | null>,
  });

  return {
    controller,
    scrollToIndex,
  };
}

describe("conversation/data/transcript-scroll", () => {
  it("uses smooth scrolling by default for same-frame post jumps", () => {
    const { controller, scrollToIndex } = createController({
      scrollOffset: 100,
    });

    controller.scrollToPost(postId);

    expect(scrollToIndex).toHaveBeenCalledWith(3, {
      align: "center",
      smooth: true,
    });
  });

  it("uses instant scrolling only when one caller explicitly requests auto", () => {
    const { controller, scrollToIndex } = createController({
      scrollOffset: 1900,
    });

    controller.scrollToPost(postId, {
      behavior: "auto",
    });

    expect(scrollToIndex).toHaveBeenCalledWith(3, {
      align: "center",
      smooth: false,
    });
  });

  it("disables smooth scrolling when reduced motion is enabled", () => {
    const { controller, scrollToIndex } = createController({
      prefersReducedMotion: true,
      scrollOffset: 100,
    });

    controller.scrollToLatest();

    expect(scrollToIndex).toHaveBeenCalledWith(9, {
      align: "end",
      smooth: false,
    });
  });

  it("treats an off-screen post above the viewport as reached", () => {
    const { handle } = createHandle({ scrollOffset: 500 });
    const controller = createConversationScrollController({
      lastRowIndex: 9,
      postIds: [postId],
      prefersReducedMotion: false,
      rowIndexByPostId: new Map([[postId, 2]]),
      scrollRootRef: {
        current: createRoot(),
      } satisfies RefObject<HTMLElement | null>,
      virtualizerRef: {
        current: handle,
      } satisfies RefObject<VirtualizerHandle | null>,
    });

    expect(
      controller.isViewReached({
        kind: "post",
        postId,
      })
    ).toBe(true);
  });
});
