import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScroll } from "@/components/school/classes/forum/conversation/hooks/use-scroll";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";

const mountedRoots: Array<() => void> = [];
const forumId = "forum_1" as Id<"schoolClassForums">;

type UseScrollProps = Parameters<typeof useScroll>[0];
type UseScrollResultValue = ReturnType<typeof useScroll>;

function createPostView(postId: Id<"schoolClassForumPosts">, offset = 0) {
  return {
    kind: "post",
    offset,
    postId,
  } as const;
}

function createPostItem(id: string): VirtualItem {
  return {
    isFirstInGroup: true,
    isLastInGroup: true,
    post: {
      _creationTime: Date.UTC(2026, 3, 20, 10, 0, 0),
      _id: id as Id<"schoolClassForumPosts">,
      attachments: [],
      body: id,
      classId: "class_1" as Id<"schoolClasses">,
      createdBy: "user_1" as Id<"users">,
      forumId: "forum_1" as Id<"schoolClassForums">,
      isUnread: false,
      mentions: [],
      myReactions: [],
      reactionCounts: [],
      reactionUsers: [],
      replyCount: 0,
      replyToBody: undefined,
      replyToUser: null,
      replyToUserId: undefined,
      sequence: 1,
      updatedAt: Date.UTC(2026, 3, 20, 10, 0, 0),
      user: null,
    },
    showContinuationTime: false,
    type: "post",
  };
}

function createUseScrollProps(
  overrides?: Partial<UseScrollProps>
): UseScrollProps {
  const items = overrides?.items ?? [
    createPostItem("post_1"),
    createPostItem("post_2"),
  ];
  const newestLoadedPostId =
    [...items].reverse().find((item) => item.type === "post")?.post._id ?? null;
  const oldestLoadedPostId =
    items.find((item) => item.type === "post")?.post._id ?? null;

  return {
    cancelPendingMarkRead: overrides?.cancelPendingMarkRead ?? vi.fn(),
    conversationIntent: overrides?.conversationIntent ?? { kind: "live" },
    flushMarkRead: overrides?.flushMarkRead ?? vi.fn(),
    hasMoreAfter: overrides?.hasMoreAfter ?? false,
    hasMoreBefore: overrides?.hasMoreBefore ?? true,
    isAtLatestEdge: overrides?.isAtLatestEdge ?? false,
    isLoadingNewer: overrides?.isLoadingNewer ?? false,
    isLoadingOlder: overrides?.isLoadingOlder ?? false,
    items,
    lastPostId: overrides?.lastPostId ?? newestLoadedPostId ?? undefined,
    latestConversationView: overrides?.latestConversationView ?? {
      current: null,
    },
    loadNewerPosts: overrides?.loadNewerPosts ?? vi.fn(),
    loadOlderPosts: overrides?.loadOlderPosts ?? vi.fn(),
    newestLoadedPostId: overrides?.newestLoadedPostId ?? newestLoadedPostId,
    oldestLoadedPostId: overrides?.oldestLoadedPostId ?? oldestLoadedPostId,
    onHighlightVisiblePost: overrides?.onHighlightVisiblePost ?? vi.fn(),
    pendingHighlightPostIdRef: overrides?.pendingHighlightPostIdRef ?? {
      current: null,
    },
    pendingLatestSessionRef: overrides?.pendingLatestSessionRef ?? {
      current: false,
    },
    persistConversationView: overrides?.persistConversationView ?? vi.fn(),
    postIdToIndex:
      overrides?.postIdToIndex ??
      new Map(
        items.flatMap((item, index) =>
          item.type === "post" ? [[item.post._id, index] as const] : []
        )
      ),
    scheduleMarkRead: overrides?.scheduleMarkRead ?? vi.fn(),
    scrollRef: overrides?.scrollRef ?? { current: null },
    timelineSessionVersion: overrides?.timelineSessionVersion ?? 0,
    unreadPostId: overrides?.unreadPostId ?? null,
  };
}

function configureContainer(
  node: HTMLDivElement,
  scrollState: { scrollTop: number }
) {
  Object.defineProperty(node, "clientHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(node, "scrollHeight", {
    configurable: true,
    value: 1200,
  });
  Object.defineProperty(node, "scrollTop", {
    configurable: true,
    get: () => scrollState.scrollTop,
    set: (value: number) => {
      scrollState.scrollTop = value;
    },
  });
  Object.defineProperty(node, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ bottom: 500, top: 100 }),
  });
  Object.defineProperty(node, "scrollTo", {
    configurable: true,
    value: ({ top }: { top: number }) => {
      scrollState.scrollTop = top;
    },
  });
}

function getItemOffset(
  items: VirtualItem[],
  topByPostId: Map<string, number>,
  index: number,
  scrollTop: number
) {
  const item = items[index];

  if (!item) {
    return 0;
  }

  if (item.type !== "post") {
    return scrollTop;
  }

  return scrollTop + (topByPostId.get(item.post._id) ?? 20 + index * 140);
}

function getItemSize(items: VirtualItem[], index: number) {
  return items[index]?.type === "post" ? 80 : 0;
}

function createVirtualHandle({
  getItems,
  scrollState,
  topByPostId,
}: {
  getItems: () => VirtualItem[];
  scrollState: { scrollTop: number };
  topByPostId: Map<string, number>;
}): VirtualConversationHandle {
  return {
    findItemIndex: (offset) => {
      const items = getItems();

      for (let index = 0; index < items.length; index += 1) {
        const itemStart = getItemOffset(
          items,
          topByPostId,
          index,
          scrollState.scrollTop
        );
        const itemEnd = itemStart + getItemSize(items, index);

        if (itemEnd > offset) {
          return index;
        }
      }

      return Math.max(0, items.length - 1);
    },
    getDistanceFromBottom: () =>
      Math.max(0, 1200 - 400 - scrollState.scrollTop),
    getItemOffset: (index) =>
      getItemOffset(getItems(), topByPostId, index, scrollState.scrollTop),
    getItemSize: (index) => getItemSize(getItems(), index),
    getScrollOffset: () => scrollState.scrollTop,
    getScrollOffsetForIndex: (index, align = "start") => {
      const items = getItems();
      const itemStart = getItemOffset(
        items,
        topByPostId,
        index,
        scrollState.scrollTop
      );
      const itemSize = getItemSize(items, index);

      if (align === "center") {
        return itemStart - (400 - itemSize) / 2;
      }

      if (align === "end") {
        return itemStart - (400 - itemSize);
      }

      return itemStart;
    },
    getViewportSize: () => 400,
    isAtBottom: () => scrollState.scrollTop >= 800,
    scrollToBottom: (_smooth) => {
      scrollState.scrollTop = 800;
      return true;
    },
    scrollToIndex: (index, options) => {
      const items = getItems();
      const itemStart = getItemOffset(
        items,
        topByPostId,
        index,
        scrollState.scrollTop
      );
      const itemSize = getItemSize(items, index);
      const offset = options?.offset ?? 0;

      scrollState.scrollTop =
        options?.align === "center"
          ? itemStart - (400 - itemSize) / 2 + offset
          : itemStart - offset;
      return true;
    },
    scrollToOffset: (offset, _smooth) => {
      scrollState.scrollTop = offset;
      return true;
    },
  };
}

function renderUseScroll(
  initialProps: UseScrollProps,
  options?: { settleInitialAnchor?: boolean }
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const scrollState = { scrollTop: 0 };
  const stableScrollRef = initialProps.scrollRef;
  const topByPostId = new Map<string, number>([
    ["post_1", 20],
    ["post_2", 160],
    ["post_3", 300],
  ]);
  let currentProps = initialProps;
  let result: UseScrollResultValue | null = null;

  function TestComponent(props: UseScrollProps) {
    result = useScroll(props);

    return createElement("div", {
      ref: (node: HTMLDivElement | null) => {
        if (result?.containerRef) {
          result.containerRef.current = node;
        }

        if (node) {
          configureContainer(node, scrollState);

          if (!props.scrollRef.current) {
            props.scrollRef.current = createVirtualHandle({
              getItems: () => currentProps.items,
              scrollState,
              topByPostId,
            });
          }
        }
      },
    });
  }

  const render = (props: UseScrollProps) => {
    currentProps = {
      ...props,
      scrollRef: stableScrollRef,
    };

    act(() => {
      root.render(createElement(TestComponent, currentProps));
    });

    if (
      options?.settleInitialAnchor === false ||
      !result ||
      currentProps.items.length === 0
    ) {
      return;
    }

    const currentResult = result;

    if (currentResult.initialAnchor) {
      act(() => {
        if (currentResult.initialAnchor?.kind === "bottom") {
          currentResult.scrollToBottom({ smooth: false });
        }

        if (currentResult.initialAnchor?.kind === "index") {
          const item = currentProps.items[currentResult.initialAnchor.index];

          if (item?.type === "post") {
            currentResult.scrollToPost(item.post._id, {
              align:
                currentResult.initialAnchor.align === "center"
                  ? "center"
                  : "start",
              offset: currentResult.initialAnchor.offset,
              smooth: false,
            });
          }
        }
      });
    }

    act(() => {
      currentResult.handleInitialAnchorSettled();
    });
  };

  render(initialProps);

  const dispose = () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };

  mountedRoots.push(dispose);

  return {
    render,
    result: () => {
      if (!result) {
        throw new Error("Expected hook result to exist.");
      }

      return result;
    },
    scrollRef: () => currentProps.scrollRef,
    scrollState,
    topByPostId,
  };
}

describe("use-scroll", () => {
  afterEach(() => {
    while (mountedRoots.length > 0) {
      mountedRoots.pop()?.();
    }

    vi.restoreAllMocks();
  });

  it("persists the initial bottom anchor once it settles", () => {
    const persistConversationView = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        isAtLatestEdge: true,
        latestConversationView: { current: { kind: "bottom" } },
        pendingLatestSessionRef: { current: true },
        persistConversationView,
      }),
      { settleInitialAnchor: false }
    );

    expect(rendered.result().initialAnchor).toEqual({ kind: "bottom" });

    act(() => {
      rendered.result().handleInitialAnchorSettled();
    });

    expect(persistConversationView).toHaveBeenCalledWith({ kind: "bottom" });

    act(() => {
      rendered.result().handleInitialAnchorSettled();
    });

    expect(persistConversationView).toHaveBeenCalledTimes(1);
  });

  it("builds a start-aligned initial anchor for saved post restores", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        conversationIntent: {
          kind: "restore",
          postId: "post_2" as Id<"schoolClassForumPosts">,
          view: createPostView("post_2" as Id<"schoolClassForumPosts">, 24),
        },
        latestConversationView: {
          current: createPostView("post_2" as Id<"schoolClassForumPosts">, 24),
        },
      }),
      { settleInitialAnchor: false }
    );

    expect(rendered.result().initialAnchor).toEqual({
      align: "start",
      index: 1,
      kind: "index",
      offset: 24,
    });
  });

  it("builds a center-aligned initial anchor for fresh jump sessions", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        conversationIntent: {
          kind: "jump",
          postId: "post_2" as Id<"schoolClassForumPosts">,
        },
      }),
      { settleInitialAnchor: false }
    );

    expect(rendered.result().initialAnchor).toEqual({
      align: "center",
      index: 1,
      kind: "index",
      offset: 0,
    });
  });

  it("builds a bottom initial anchor when the latest edge should be restored", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        latestConversationView: { current: { kind: "bottom" } },
        pendingLatestSessionRef: { current: true },
      }),
      { settleInitialAnchor: false }
    );

    expect(rendered.result().initialAnchor).toEqual({ kind: "bottom" });
  });

  it("ignores non-post transcript items when tracking visible post order", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        items: [
          { forum: { _id: forumId }, type: "header" } as VirtualItem,
          { date: Date.UTC(2026, 3, 20, 0, 0, 0), type: "date" } as VirtualItem,
          createPostItem("post_1"),
        ],
        postIdToIndex: new Map([["post_1" as Id<"schoolClassForumPosts">, 2]]),
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    expect(rendered.result().captureCurrentConversationView()).toEqual({
      ...createPostView("post_1" as Id<"schoolClassForumPosts">, 20),
    });
  });

  it("captures the first visible post as the current conversation view", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    expect(rendered.result().captureCurrentConversationView()).toEqual({
      ...createPostView("post_1" as Id<"schoolClassForumPosts">, 20),
    });
  });

  it("reports whether a registered post row is currently visible", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    expect(
      rendered.result().isPostVisible("post_1" as Id<"schoolClassForumPosts">)
    ).toBe(true);

    rendered.result().containerRef.current = null;

    expect(
      rendered.result().isPostVisible("post_1" as Id<"schoolClassForumPosts">)
    ).toBe(false);

    expect(
      rendered.result().isPostVisible("missing" as Id<"schoolClassForumPosts">)
    ).toBe(false);
  });

  it("skips visible non-post items when resolving the current post anchor", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        items: [
          { date: Date.UTC(2026, 3, 20, 0, 0, 0), type: "date" } as VirtualItem,
          createPostItem("post_1"),
        ],
        postIdToIndex: new Map([["post_1" as Id<"schoolClassForumPosts">, 1]]),
        scrollRef: {
          current: {
            findItemIndex: vi.fn(() => 0),
            getDistanceFromBottom: vi.fn(() => 200),
            getItemOffset: vi.fn((index: number) => (index === 0 ? 0 : 20)),
            getItemSize: vi.fn((index: number) => (index === 0 ? 10 : 80)),
            getScrollOffset: vi.fn(() => 0),
            getScrollOffsetForIndex: vi.fn(() => 0),
            getViewportSize: vi.fn(() => 400),
            isAtBottom: vi.fn(() => false),
            scrollToBottom: vi.fn(() => true),
            scrollToIndex: vi.fn(() => true),
            scrollToOffset: vi.fn(() => true),
          },
        },
      })
    );

    expect(rendered.result().captureCurrentConversationView()).toEqual({
      ...createPostView("post_1" as Id<"schoolClassForumPosts">, 20),
    });
  });

  it("returns null when the virtual handle reaches the end without a visible post", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        items: [
          { date: Date.UTC(2026, 3, 20, 0, 0, 0), type: "date" } as VirtualItem,
        ],
        postIdToIndex: new Map(),
        scrollRef: {
          current: {
            findItemIndex: vi.fn(() => 0),
            getDistanceFromBottom: vi.fn(() => 200),
            getItemOffset: vi.fn(() => 0),
            getItemSize: vi.fn(() => 0),
            getScrollOffset: vi.fn(() => 0),
            getScrollOffsetForIndex: vi.fn(() => 0),
            getViewportSize: vi.fn(() => 400),
            isAtBottom: vi.fn(() => false),
            scrollToBottom: vi.fn(() => true),
            scrollToIndex: vi.fn(() => true),
            scrollToOffset: vi.fn(() => true),
          },
        },
      })
    );

    expect(rendered.result().captureCurrentConversationView()).toBeNull();
  });

  it("falls back to virtual scroll when a loaded target row is not mounted", () => {
    const scrollToIndex = vi.fn(() => true);
    const rendered = renderUseScroll(
      createUseScrollProps({
        postIdToIndex: new Map([["post_3" as Id<"schoolClassForumPosts">, 2]]),
        scrollRef: {
          current: {
            findItemIndex: vi.fn(() => 0),
            getDistanceFromBottom: vi.fn(() => 0),
            getItemOffset: vi.fn(() => 0),
            getItemSize: vi.fn(() => 80),
            getScrollOffset: vi.fn(() => 0),
            getScrollOffsetForIndex: vi.fn(() => 0),
            getViewportSize: vi.fn(() => 400),
            isAtBottom: vi.fn(() => false),
            scrollToBottom: vi.fn(() => true),
            scrollToIndex,
            scrollToOffset: vi.fn(() => true),
          },
        },
      })
    );

    rendered.topByPostId.delete("post_3");

    expect(
      rendered.result().scrollToPost("post_3" as Id<"schoolClassForumPosts">)
    ).toBe(true);
    expect(scrollToIndex).toHaveBeenCalled();
  });

  it("restores the same visible post after older history prepends above it", () => {
    const loadOlderPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        loadOlderPosts,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    rendered.scrollState.scrollTop = 0;

    act(() => {
      rendered.result().handleScroll(0);
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(1);

    rendered.topByPostId.set("post_1", 160);

    rendered.render(
      createUseScrollProps({
        isLoadingOlder: true,
        loadOlderPosts,
      })
    );

    rendered.render(
      createUseScrollProps({
        isLoadingOlder: false,
        items: [
          createPostItem("post_0"),
          createPostItem("post_1"),
          createPostItem("post_2"),
        ],
        loadOlderPosts,
      })
    );

    expect(rendered.scrollState.scrollTop).toBe(140);
  });

  it("restores prepended history from the resolved index offset when the anchor row is not mounted", () => {
    const loadOlderPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        loadOlderPosts,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    rendered.scrollState.scrollTop = 0;

    act(() => {
      rendered.result().handleScroll(0);
    });

    const scrollHandle = rendered.scrollRef().current;

    if (!scrollHandle) {
      throw new Error("Expected virtual scroll handle to exist.");
    }

    rendered.topByPostId.set("post_1", 160);

    scrollHandle.getItemOffset = vi.fn((index: number) =>
      index === 1 ? 0 : 20 + index * 140
    );
    scrollHandle.getScrollOffsetForIndex = vi.fn((index: number) =>
      index === 1 ? 160 : 20 + index * 140
    );

    rendered.render(
      createUseScrollProps({
        isLoadingOlder: true,
        loadOlderPosts,
      })
    );

    rendered.render(
      createUseScrollProps({
        isLoadingOlder: false,
        items: [
          createPostItem("post_0"),
          createPostItem("post_1"),
          createPostItem("post_2"),
        ],
        loadOlderPosts,
      })
    );

    expect(scrollHandle.getScrollOffsetForIndex).toHaveBeenCalledWith(
      1,
      "start"
    );
    expect(rendered.scrollState.scrollTop).toBe(140);
  });

  it("persists the settled view after scroll ends", () => {
    vi.useFakeTimers();
    const persistConversationView = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        persistConversationView,
      })
    );

    act(() => {
      rendered.result().handleScroll(10);
      vi.advanceTimersByTime(100);
    });

    expect(persistConversationView).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("persists a null settled view when no visible post anchor can be resolved", () => {
    vi.useFakeTimers();
    const persistConversationView = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        persistConversationView,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    rendered.scrollState.scrollTop = 200;
    rendered.topByPostId.set("post_1", -220);
    rendered.topByPostId.set("post_2", 500);

    rendered.render(
      createUseScrollProps({
        persistConversationView,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    act(() => {
      rendered.result().handleScroll(200);
      vi.advanceTimersByTime(100);
    });

    expect(persistConversationView).toHaveBeenCalledWith(null);
    vi.useRealTimers();
  });

  it("restarts settled-scroll work cleanly when the transcript session changes", () => {
    vi.useFakeTimers();
    const persistConversationView = vi.fn();
    const initialProps = createUseScrollProps({ persistConversationView });
    const rendered = renderUseScroll(initialProps);

    act(() => {
      rendered.result().handleScroll(10);
    });

    rendered.render({
      ...initialProps,
      items: [],
      pendingLatestSessionRef: { current: true },
      timelineSessionVersion: 1,
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(persistConversationView).toHaveBeenCalledWith({ kind: "bottom" });
    vi.useRealTimers();
  });

  it("drops settled-scroll work when the transcript container is already gone", () => {
    vi.useFakeTimers();
    const persistConversationView = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        persistConversationView,
      })
    );

    act(() => {
      rendered.result().handleScroll(10);
    });

    const callsBeforeDetach = persistConversationView.mock.calls.length;

    rendered.result().containerRef.current = null;

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(persistConversationView).toHaveBeenCalledTimes(callsBeforeDetach);
    vi.useRealTimers();
  });

  it("returns null or false when the transcript container is unavailable", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    rendered.result().containerRef.current = null;

    expect(rendered.result().captureCurrentConversationView()).toBeNull();
    expect(rendered.result().scrollToBottom()).toBe(false);
    expect(
      rendered.result().scrollToPost("missing" as Id<"schoolClassForumPosts">)
    ).toBe(false);

    act(() => {
      rendered.result().handleScroll(0);
    });
  });

  it("scrolls to bottom with smooth behavior when requested", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    expect(rendered.result().scrollToBottom({ smooth: true })).toBe(true);
    expect(rendered.scrollState.scrollTop).toBe(800);
  });

  it("uses the virtual handle for bottom scrolling when available", () => {
    const scrollToBottom = vi.fn(() => true);
    const rendered = renderUseScroll(
      createUseScrollProps({
        scrollRef: {
          current: {
            findItemIndex: vi.fn(() => 0),
            getDistanceFromBottom: vi.fn(() => 0),
            getItemOffset: vi.fn(() => 0),
            getItemSize: vi.fn(() => 80),
            getScrollOffset: vi.fn(() => 0),
            getScrollOffsetForIndex: vi.fn(() => 0),
            getViewportSize: vi.fn(() => 400),
            isAtBottom: vi.fn(() => false),
            scrollToBottom,
            scrollToIndex: vi.fn(() => true),
            scrollToOffset: vi.fn(() => true),
          },
        },
      })
    );

    expect(rendered.result().scrollToBottom({ smooth: false })).toBe(true);
    expect(scrollToBottom).toHaveBeenCalledWith(false);
  });

  it("scrolls to bottom with auto behavior by default", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    expect(rendered.result().scrollToBottom()).toBe(true);
    expect(rendered.scrollState.scrollTop).toBe(800);
  });

  it("scrolls to bottom with explicit auto behavior when smooth is false", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    expect(rendered.result().scrollToBottom({ smooth: false })).toBe(true);
    expect(rendered.scrollState.scrollTop).toBe(800);
  });

  it("falls back to container scrolling when the virtual bottom handle declines", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        scrollRef: {
          current: {
            findItemIndex: vi.fn(() => 0),
            getDistanceFromBottom: vi.fn(() => 0),
            getItemOffset: vi.fn(() => 0),
            getItemSize: vi.fn(() => 80),
            getScrollOffset: vi.fn(() => 0),
            getScrollOffsetForIndex: vi.fn(() => 0),
            getViewportSize: vi.fn(() => 400),
            isAtBottom: vi.fn(() => false),
            scrollToBottom: vi.fn(() => false),
            scrollToIndex: vi.fn(() => true),
            scrollToOffset: vi.fn(() => true),
          },
        },
      })
    );

    expect(rendered.result().scrollToBottom({ smooth: true })).toBe(true);
    expect(rendered.scrollState.scrollTop).toBe(1200);
  });

  it("scrolls directly to a visible post using default start alignment", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    expect(
      rendered.result().scrollToPost("post_2" as Id<"schoolClassForumPosts">)
    ).toBe(true);
    expect(rendered.scrollState.scrollTop).toBe(180);
  });

  it("scrolls directly to a visible post with center alignment", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    expect(
      rendered.result().scrollToPost("post_2" as Id<"schoolClassForumPosts">, {
        align: "center",
      })
    ).toBe(true);
    expect(rendered.scrollState.scrollTop).toBe(20);
  });

  it("returns false when a virtual fallback target has no handle", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        postIdToIndex: new Map([["post_3" as Id<"schoolClassForumPosts">, 2]]),
        scrollRef: {
          current: {
            findItemIndex: vi.fn(() => 0),
            getDistanceFromBottom: vi.fn(() => 0),
            getItemOffset: vi.fn(() => 0),
            getItemSize: vi.fn(() => 80),
            getScrollOffset: vi.fn(() => 0),
            getScrollOffsetForIndex: vi.fn(() => 0),
            getViewportSize: vi.fn(() => 400),
            isAtBottom: vi.fn(() => false),
            scrollToBottom: vi.fn(() => true),
            scrollToIndex: vi.fn(() => false),
            scrollToOffset: vi.fn(() => true),
          },
        },
      })
    );

    rendered.topByPostId.delete("post_3");

    expect(
      rendered.result().scrollToPost("post_3" as Id<"schoolClassForumPosts">)
    ).toBe(false);
  });

  it("returns false when a requested post id does not exist in the virtual items", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    expect(
      rendered.result().scrollToPost("missing" as Id<"schoolClassForumPosts">)
    ).toBe(false);
  });

  it("returns false when a requested post exists but the virtual handle is gone", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    rendered.scrollRef().current = null;

    expect(
      rendered.result().scrollToPost("post_1" as Id<"schoolClassForumPosts">)
    ).toBe(false);
  });

  it("returns null when no visible post row intersects the transcript viewport", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    rendered.scrollState.scrollTop = 200;
    rendered.topByPostId.set("post_1", -220);
    rendered.topByPostId.set("post_2", 500);

    rendered.render(
      createUseScrollProps({
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    expect(rendered.result().captureCurrentConversationView()).toBeNull();
  });

  it("returns null when no virtual handle is available for capture", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        scrollRef: { current: null },
      })
    );

    rendered.scrollRef().current = null;
    rendered.scrollState.scrollTop = 100;

    expect(rendered.result().captureCurrentConversationView()).toBeNull();
  });

  it("does not request history when boundaries or geometry do not allow it", () => {
    const loadOlderPosts = vi.fn();
    const loadNewerPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        hasMoreAfter: false,
        hasMoreBefore: false,
        loadNewerPosts,
        loadOlderPosts,
      })
    );

    act(() => {
      rendered.result().handleScroll(0);
      rendered.result().handleScroll(790);
    });

    expect(loadOlderPosts).not.toHaveBeenCalled();
    expect(loadNewerPosts).not.toHaveBeenCalled();
  });

  it("still loads older history when no visible post anchor can be preserved", () => {
    const loadOlderPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        loadOlderPosts,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    rendered.topByPostId.set("post_1", -220);
    rendered.topByPostId.set("post_2", 500);

    rendered.render(
      createUseScrollProps({
        loadOlderPosts,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    act(() => {
      rendered.result().handleScroll(0);
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(1);
  });

  it("requests newer history when the user scrolls down near the bottom edge", () => {
    const loadNewerPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        hasMoreAfter: true,
        loadNewerPosts,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    rendered.scrollState.scrollTop = 790;

    act(() => {
      rendered.result().handleScroll(790);
    });

    expect(loadNewerPosts).toHaveBeenCalledTimes(1);
  });

  it("persists a bottom snapshot after an explicit latest-edge landing", () => {
    vi.useFakeTimers();
    const persistConversationView = vi.fn();
    const scheduleMarkRead = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        isAtLatestEdge: true,
        persistConversationView,
        scheduleMarkRead,
      })
    );

    rendered.scrollState.scrollTop = 800;

    act(() => {
      rendered.result().markPendingBottomPersistence();
      rendered.result().handleScroll(800);
      vi.advanceTimersByTime(100);
    });

    expect(persistConversationView).toHaveBeenCalledWith({ kind: "bottom" });
    expect(scheduleMarkRead).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("notifies when a pending highlight target becomes visible", () => {
    const onHighlightVisiblePost = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        onHighlightVisiblePost,
        pendingHighlightPostIdRef: {
          current: "post_1" as Id<"schoolClassForumPosts">,
        },
      })
    );

    act(() => {
      rendered.result().handleScroll(0);
    });

    expect(onHighlightVisiblePost).toHaveBeenCalledWith(
      "post_1" as Id<"schoolClassForumPosts">
    );
  });

  it("schedules read state when scroll settling ends at the live bottom", () => {
    vi.useFakeTimers();
    const scheduleMarkRead = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        isAtLatestEdge: true,
        scheduleMarkRead,
      })
    );

    rendered.scrollState.scrollTop = 800;

    act(() => {
      rendered.result().handleScroll(800);
      vi.advanceTimersByTime(100);
    });

    expect(scheduleMarkRead).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("skips the initial anchor when the target post is unavailable", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        conversationIntent: {
          kind: "jump",
          postId: "post_3" as Id<"schoolClassForumPosts">,
        },
        items: [createPostItem("post_1"), createPostItem("post_2")],
        postIdToIndex: new Map(),
      })
    );

    expect(rendered.result().initialAnchor).toBeNull();
  });

  it("does not persist a snapshot when no fallback view exists", () => {
    const persistConversationView = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        conversationIntent: {
          kind: "jump",
          postId: "post_3" as Id<"schoolClassForumPosts">,
        },
        latestConversationView: { current: null },
        persistConversationView,
        postIdToIndex: new Map(),
      }),
      { settleInitialAnchor: false }
    );

    rendered.topByPostId.set("post_1", -220);
    rendered.topByPostId.set("post_2", 500);

    act(() => {
      rendered.result().handleInitialAnchorSettled();
    });

    expect(persistConversationView).not.toHaveBeenCalled();
  });

  it("does nothing when the initial anchor settles after the transcript container disappears", () => {
    const persistConversationView = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        isAtLatestEdge: true,
        latestConversationView: { current: { kind: "bottom" } },
        pendingLatestSessionRef: { current: true },
        persistConversationView,
      }),
      { settleInitialAnchor: false }
    );

    rendered.result().containerRef.current = null;

    act(() => {
      rendered.result().handleInitialAnchorSettled();
    });

    expect(persistConversationView).not.toHaveBeenCalled();
  });

  it("flushes read state when a new latest post arrives near bottom", () => {
    const flushMarkRead = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        pendingLatestSessionRef: { current: true },
      })
    );

    rendered.scrollState.scrollTop = 790;

    rendered.render(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        items: [
          createPostItem("post_1"),
          createPostItem("post_2"),
          createPostItem("post_3"),
        ],
        lastPostId: "post_3" as Id<"schoolClassForumPosts">,
        pendingLatestSessionRef: { current: false },
      })
    );

    expect(flushMarkRead).toHaveBeenCalledWith(
      "post_3" as Id<"schoolClassForumPosts">
    );
  });

  it("does not flush read state when a new latest post arrives away from bottom", () => {
    const flushMarkRead = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        pendingLatestSessionRef: { current: true },
      })
    );

    rendered.scrollState.scrollTop = 100;

    rendered.render(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        items: [
          createPostItem("post_1"),
          createPostItem("post_2"),
          createPostItem("post_3"),
        ],
        lastPostId: "post_3" as Id<"schoolClassForumPosts">,
        pendingLatestSessionRef: { current: false },
      })
    );

    expect(flushMarkRead).not.toHaveBeenCalled();
  });

  it("skips older-anchor restoration when no older rows were added", () => {
    const loadOlderPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        loadOlderPosts,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    act(() => {
      rendered.result().handleScroll(0);
    });

    rendered.render(
      createUseScrollProps({
        isLoadingOlder: true,
        loadOlderPosts,
      })
    );

    rendered.render(
      createUseScrollProps({
        isLoadingOlder: false,
        loadOlderPosts,
      })
    );

    expect(rendered.scrollState.scrollTop).toBe(20);
  });

  it("drops older-anchor restoration when the anchor row disappears", () => {
    const loadOlderPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        loadOlderPosts,
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    act(() => {
      rendered.result().handleScroll(0);
    });

    rendered.render(
      createUseScrollProps({
        isLoadingOlder: true,
        loadOlderPosts,
      })
    );

    rendered.topByPostId.delete("post_1");

    rendered.render(
      createUseScrollProps({
        isLoadingOlder: false,
        items: [createPostItem("post_0"), createPostItem("post_2")],
        postIdToIndex: new Map([
          ["post_0" as Id<"schoolClassForumPosts">, 0],
          ["post_2" as Id<"schoolClassForumPosts">, 1],
        ]),
        loadOlderPosts,
      })
    );

    expect(rendered.scrollState.scrollTop).toBe(20);
  });

  it("arms and clears pending bottom persistence and resets session state", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    act(() => {
      rendered.result().markPendingBottomPersistence();
      rendered.result().resetPendingBottomPersistence();
      rendered.result().resetScrollState();
    });

    expect(rendered.result().scrollToBottom()).toBe(true);
  });
});
