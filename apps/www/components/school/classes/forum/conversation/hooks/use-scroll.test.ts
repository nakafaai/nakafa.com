import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScroll } from "@/components/school/classes/forum/conversation/hooks/use-scroll";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";

const mountedRoots: Array<() => void> = [];
const forumId = "forum_1" as Id<"schoolClassForums">;

type UseScrollProps = Parameters<typeof useScroll>[0];
type UseScrollResultValue = ReturnType<typeof useScroll>;

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
    onNavigationSettled: overrides?.onNavigationSettled ?? vi.fn(),
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

function configurePostElement(
  node: HTMLDivElement,
  topByPostId: Map<string, number>,
  postId: string,
  height = 80
) {
  Object.defineProperty(node, "offsetHeight", {
    configurable: true,
    value: height,
  });
  Object.defineProperty(node, "getBoundingClientRect", {
    configurable: true,
    value: () => {
      const top = topByPostId.get(postId) ?? 20;

      return { bottom: 100 + top + height, top: 100 + top };
    },
  });
}

function renderUseScroll(initialProps: UseScrollProps) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const scrollState = { scrollTop: 0 };
  const topByPostId = new Map<string, number>([
    ["post_1", 20],
    ["post_2", 160],
    ["post_3", 300],
  ]);
  let result: UseScrollResultValue | null = null;

  function TestComponent(props: UseScrollProps) {
    result = useScroll(props);

    return createElement(
      "div",
      {
        ref: (node: HTMLDivElement | null) => {
          if (result?.containerRef) {
            result.containerRef.current = node;
          }

          if (node) {
            configureContainer(node, scrollState);
          }
        },
      },
      props.items.map((item) => {
        if (item.type !== "post") {
          return null;
        }

        return createElement("div", {
          key: item.post._id,
          ref: (node: HTMLDivElement | null) => {
            result?.registerPostElement(item.post._id, node);

            if (node) {
              configurePostElement(node, topByPostId, item.post._id);
            }
          },
        });
      })
    );
  }

  const render = (props: UseScrollProps) => {
    act(() => {
      root.render(createElement(TestComponent, props));
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

  it("reveals the transcript and persists the initial bottom view", () => {
    const persistConversationView = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        isAtLatestEdge: true,
        latestConversationView: { current: { kind: "bottom" } },
        pendingLatestSessionRef: { current: true },
        persistConversationView,
      })
    );

    expect(rendered.result().isConversationRevealed).toBe(true);
    expect(persistConversationView).toHaveBeenCalledWith({ kind: "bottom" });
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
      kind: "post",
      offset: 20,
      postId: "post_1",
    });
  });

  it("captures the first visible post as the current conversation view", () => {
    const rendered = renderUseScroll(
      createUseScrollProps({
        unreadPostId: "post_1" as Id<"schoolClassForumPosts">,
      })
    );

    expect(rendered.result().captureCurrentConversationView()).toEqual({
      kind: "post",
      offset: 20,
      postId: "post_1",
    });
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
            getViewportSize: vi.fn(() => 400),
            isAtBottom: vi.fn(() => false),
            scrollToBottom: vi.fn(() => true),
            scrollToIndex,
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

    act(() => {
      rendered.result().handleScroll(0);
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(1);

    rendered.topByPostId.set("post_1", 60);

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
          createPostItem("post_2"),
          createPostItem("post_3"),
        ],
        loadOlderPosts,
      })
    );

    expect(rendered.scrollState.scrollTop).toBe(20);
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

  it("drops stale settled-scroll work when the transcript session changes", () => {
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

    expect(rendered.result().isConversationRevealed).toBe(false);
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

  it("scrolls to bottom with auto behavior by default", () => {
    const rendered = renderUseScroll(createUseScrollProps());

    expect(rendered.result().scrollToBottom()).toBe(true);
    expect(rendered.scrollState.scrollTop).toBe(800);
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
      })
    );

    rendered.topByPostId.delete("post_3");

    expect(
      rendered.result().scrollToPost("post_3" as Id<"schoolClassForumPosts">)
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
    const onNavigationSettled = vi.fn();
    const persistConversationView = vi.fn();
    const scheduleMarkRead = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        isAtLatestEdge: true,
        onNavigationSettled,
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
    expect(onNavigationSettled).toHaveBeenCalled();
    expect(scheduleMarkRead).toHaveBeenCalled();
    vi.useRealTimers();
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

  it("keeps the transcript hidden when the initial target cannot be restored yet", () => {
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

    expect(rendered.result().isConversationRevealed).toBe(false);
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
        items: [
          createPostItem("post_0"),
          createPostItem("post_1"),
          createPostItem("post_2"),
        ],
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

    expect(rendered.result().isConversationRevealed).toBe(false);
  });
});
