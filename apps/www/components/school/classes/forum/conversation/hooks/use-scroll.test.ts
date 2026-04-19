import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { VirtualConversationHandle } from "@repo/design-system/types/virtual";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScroll } from "@/components/school/classes/forum/conversation/hooks/use-scroll";
import type { VirtualItem } from "@/components/school/classes/forum/conversation/types";
import type { ForumConversationView } from "@/lib/store/forum";

type UseScrollProps = Parameters<typeof useScroll>[0];
type UseScrollResultValue = ReturnType<typeof useScroll>;

interface MutableScrollState {
  atBottom: boolean;
  distanceFromBottom: number;
  itemSize: number;
  offset: number;
  viewportSize: number;
}

const mountedRoots: Array<() => void> = [];

/** Returns one rendered hook result or throws when the test forgot to mount it. */
function requireResult<T>(value: T): NonNullable<T> {
  if (!value) {
    throw new Error("Expected hook result to exist.");
  }

  return value as NonNullable<T>;
}

/** Creates one mutable virtual-conversation handle for hook scroll tests. */
function createScrollHandle(overrides?: Partial<MutableScrollState>): {
  handle: VirtualConversationHandle;
  state: MutableScrollState;
} {
  const state: MutableScrollState = {
    atBottom: overrides?.atBottom ?? false,
    distanceFromBottom: overrides?.distanceFromBottom ?? 1200,
    itemSize: overrides?.itemSize ?? 80,
    offset: overrides?.offset ?? 0,
    viewportSize: overrides?.viewportSize ?? 800,
  };

  return {
    handle: {
      findItemIndex: vi.fn(() => 0),
      getDistanceFromBottom: vi.fn(() => state.distanceFromBottom),
      getItemOffset: vi.fn(() => 0),
      getItemSize: vi.fn(() => state.itemSize),
      getScrollOffset: vi.fn(() => state.offset),
      getViewportSize: vi.fn(() => state.viewportSize),
      isAtBottom: vi.fn(() => state.atBottom),
      scrollToBottom: vi.fn(),
      scrollToIndex: vi.fn(),
    },
    state,
  };
}

/** Creates one minimal post row for scroll hook tests. */
function createPostItem(id: string): VirtualItem {
  const postId = id as Id<"schoolClassForumPosts">;

  return {
    isFirstInGroup: true,
    isLastInGroup: true,
    post: {
      _creationTime: Date.UTC(2026, 3, 20, 10, 0, 0),
      _id: postId,
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

/** Builds one index map for the current rendered post rows. */
function createPostIndex(items: VirtualItem[]) {
  return new Map(
    items.flatMap((item, index) =>
      item.type === "post" ? [[item.post._id, index] as const] : []
    )
  );
}

/** Returns one post id from a virtual item and fails fast for invalid fixtures. */
function getRequiredPostId(item: VirtualItem) {
  if (item.type !== "post") {
    throw new Error("Expected one post item.");
  }

  return item.post._id;
}

/** Creates one stable fallback view used by the scroll hook test harness. */
function createView(
  postId: Id<"schoolClassForumPosts">
): ForumConversationView {
  return {
    kind: "post",
    offset: 0,
    postId,
  };
}

/** Creates one complete prop bag for the scroll hook test harness. */
function createUseScrollProps(
  overrides: Partial<UseScrollProps>
): UseScrollProps {
  const items = overrides.items ?? [
    createPostItem("post_1"),
    createPostItem("post_2"),
  ];
  const firstPostId =
    items.find((item) => item.type === "post")?.post._id ??
    ("post_1" as Id<"schoolClassForumPosts">);
  const lastRenderedPost = [...items]
    .reverse()
    .find((item) => item.type === "post");
  const newestLoadedPostId =
    lastRenderedPost?.type === "post" ? lastRenderedPost.post._id : null;
  const oldestLoadedPostId =
    items.find((item) => item.type === "post")?.post._id ?? null;

  return {
    cancelPendingMarkRead: overrides.cancelPendingMarkRead ?? vi.fn(),
    captureCurrentConversationView:
      overrides.captureCurrentConversationView ??
      vi.fn(() => createView(firstPostId)),
    conversationIntent: overrides.conversationIntent ?? { kind: "live" },
    flushMarkRead: overrides.flushMarkRead ?? vi.fn(),
    hasMoreAfter: overrides.hasMoreAfter ?? false,
    hasMoreBefore: overrides.hasMoreBefore ?? true,
    isAtLatestEdge: overrides.isAtLatestEdge ?? false,
    isLoadingNewer: overrides.isLoadingNewer ?? false,
    isLoadingOlder: overrides.isLoadingOlder ?? false,
    items,
    lastPostId: overrides.lastPostId ?? newestLoadedPostId ?? undefined,
    latestConversationView: overrides.latestConversationView ?? {
      current: null,
    },
    loadNewerPosts: overrides.loadNewerPosts ?? vi.fn(),
    loadOlderPosts: overrides.loadOlderPosts ?? vi.fn(),
    newestLoadedPostId: overrides.newestLoadedPostId ?? newestLoadedPostId,
    onNavigationSettled: overrides.onNavigationSettled ?? vi.fn(),
    oldestLoadedPostId: overrides.oldestLoadedPostId ?? oldestLoadedPostId,
    pendingLatestSessionRef: overrides.pendingLatestSessionRef ?? {
      current: false,
    },
    persistConversationView: overrides.persistConversationView ?? vi.fn(),
    postIdToIndex: overrides.postIdToIndex ?? createPostIndex(items),
    pruneReachedBackHistory: overrides.pruneReachedBackHistory ?? vi.fn(),
    scheduleMarkRead: overrides.scheduleMarkRead ?? vi.fn(),
    scrollRef: overrides.scrollRef ?? { current: null },
    timelineSessionVersion: overrides.timelineSessionVersion ?? 0,
    unreadIndex: overrides.unreadIndex ?? null,
  };
}

/** Mounts one `useScroll` implementation in a tiny React tree for tests. */
function renderUseScrollWithHook(
  hook: (props: UseScrollProps) => UseScrollResultValue,
  initialProps: UseScrollProps
) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let result: UseScrollResultValue | null = null;

  function TestComponent(props: UseScrollProps) {
    result = hook(props);
    return null;
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
    dispose,
    render,
    result: () => requireResult(result),
  };
}

/** Mounts the real `useScroll` hook in a tiny React tree for tests. */
function renderUseScroll(initialProps: UseScrollProps) {
  return renderUseScrollWithHook(useScroll, initialProps);
}

describe("use-scroll", () => {
  afterEach(() => {
    while (mountedRoots.length > 0) {
      mountedRoots.pop()?.();
    }

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("continues older paging while the user stays parked near the top edge", () => {
    const initialItems = [createPostItem("post_1"), createPostItem("post_2")];
    const prependedItems = [createPostItem("post_0"), ...initialItems];
    const { handle, state } = createScrollHandle({ offset: 700 });
    const loadOlderPosts = vi.fn();
    const initialProps = createUseScrollProps({
      items: initialItems,
      loadOlderPosts,
      oldestLoadedPostId:
        initialItems[0].type === "post" ? initialItems[0].post._id : null,
      postIdToIndex: createPostIndex(initialItems),
      scrollRef: { current: handle },
    });
    const rendered = renderUseScroll(initialProps);

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    state.offset = 500;

    act(() => {
      rendered.result().handleScroll(500);
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(1);

    rendered.render({
      ...initialProps,
      isLoadingOlder: true,
    });

    expect(rendered.result().isPrepending).toBe(true);

    state.offset = 400;

    rendered.render({
      ...initialProps,
      isLoadingOlder: false,
      items: prependedItems,
      oldestLoadedPostId:
        prependedItems[0].type === "post" ? prependedItems[0].post._id : null,
      postIdToIndex: createPostIndex(prependedItems),
    });

    expect(rendered.result().isPrepending).toBe(false);
    expect(loadOlderPosts).toHaveBeenCalledTimes(2);

    act(() => {
      rendered.result().handleScrollEnd();
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(2);
  });

  it("keeps or clears older edge continuation based on follow-up scroll intent", () => {
    const { handle, state } = createScrollHandle({ offset: 700 });
    const loadOlderPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        loadOlderPosts,
        scrollRef: { current: handle },
      })
    );

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    state.offset = 500;

    act(() => {
      rendered.result().handleScroll(500);
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(1);

    act(() => {
      rendered.result().handleScroll(500);
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(1);

    state.viewportSize = 0;

    act(() => {
      rendered.result().handleScrollEnd();
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(1);

    state.viewportSize = 800;
    state.offset = 520;

    act(() => {
      rendered.result().handleScroll(520);
      rendered.result().handleScrollEnd();
    });

    expect(loadOlderPosts).toHaveBeenCalledTimes(1);
  });

  it("continues newer paging while the user stays parked near the bottom edge", () => {
    const initialItems = [createPostItem("post_1"), createPostItem("post_2")];
    const appendedItems = [...initialItems, createPostItem("post_3")];
    const { handle, state } = createScrollHandle({
      distanceFromBottom: 700,
      offset: 100,
    });
    const loadNewerPosts = vi.fn();
    const initialProps = createUseScrollProps({
      hasMoreAfter: true,
      items: initialItems,
      loadNewerPosts,
      newestLoadedPostId:
        initialItems[1]?.type === "post" ? initialItems[1].post._id : null,
      postIdToIndex: createPostIndex(initialItems),
      scrollRef: { current: handle },
    });
    const rendered = renderUseScroll(initialProps);

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    state.distanceFromBottom = 100;
    state.offset = 200;

    act(() => {
      rendered.result().handleScroll(200);
    });

    expect(loadNewerPosts).toHaveBeenCalledTimes(1);

    rendered.render({
      ...initialProps,
      isLoadingNewer: true,
    });

    rendered.render({
      ...initialProps,
      isLoadingNewer: false,
      items: appendedItems,
      newestLoadedPostId:
        appendedItems[2]?.type === "post" ? appendedItems[2].post._id : null,
      postIdToIndex: createPostIndex(appendedItems),
    });

    expect(loadNewerPosts).toHaveBeenCalledTimes(2);

    state.offset = 180;

    act(() => {
      rendered.result().handleScroll(180);
      rendered.result().handleScrollEnd();
    });

    expect(loadNewerPosts).toHaveBeenCalledTimes(2);
  });

  it("clears armed newer continuation once the user scrolls away from the bottom edge", () => {
    const { handle, state } = createScrollHandle({
      distanceFromBottom: 100,
      offset: 100,
    });
    const loadNewerPosts = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        hasMoreAfter: true,
        loadNewerPosts,
        scrollRef: { current: handle },
      })
    );

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    state.offset = 200;

    act(() => {
      rendered.result().handleScroll(200);
    });

    expect(loadNewerPosts).toHaveBeenCalledTimes(1);

    state.distanceFromBottom = 100;
    state.offset = 180;

    act(() => {
      rendered.result().handleScroll(180);
      rendered.result().handleScrollEnd();
    });

    expect(loadNewerPosts).toHaveBeenCalledTimes(1);
  });

  it("restarts one session cleanly and reuses the initial-view fallback", () => {
    const cancelPendingMarkRead = vi.fn();
    const captureCurrentConversationView = vi.fn(() => null);
    const persistConversationView = vi.fn();
    const pendingLatestSessionRef = { current: true };
    const rendered = renderUseScroll(
      createUseScrollProps({
        cancelPendingMarkRead,
        captureCurrentConversationView,
        pendingLatestSessionRef,
        persistConversationView,
        scrollRef: { current: null },
      })
    );

    act(() => {
      rendered.result().handleScroll(0);
    });

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    expect(persistConversationView).toHaveBeenCalledWith({ kind: "bottom" });
    expect(cancelPendingMarkRead).toHaveBeenCalledTimes(1);

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    expect(persistConversationView).toHaveBeenCalledTimes(1);

    rendered.render(
      createUseScrollProps({
        cancelPendingMarkRead,
        captureCurrentConversationView,
        pendingLatestSessionRef,
        persistConversationView,
        scrollRef: { current: null },
        timelineSessionVersion: 1,
      })
    );

    expect(rendered.result().isConversationRevealed).toBe(false);

    act(() => {
      rendered.result().handleScrollEnd();
    });

    expect(persistConversationView).toHaveBeenCalledTimes(2);
  });

  it("persists the bottom landing and executes scheduled scroll commands", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    const items = [createPostItem("post_1"), createPostItem("post_2")];
    const targetPostId = getRequiredPostId(items[1] ?? items[0]);
    const persistConversationView = vi.fn();
    const scheduleMarkRead = vi.fn();
    const latestConversationView = { current: null };
    const { handle, state } = createScrollHandle({
      atBottom: true,
      distanceFromBottom: 0,
      offset: 200,
    });
    const rendered = renderUseScroll(
      createUseScrollProps({
        isAtLatestEdge: true,
        items,
        latestConversationView,
        persistConversationView,
        postIdToIndex: createPostIndex(items),
        scheduleMarkRead,
        scrollRef: { current: handle },
      })
    );

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    expect(scheduleMarkRead).toHaveBeenCalledWith(targetPostId);

    act(() => {
      rendered.result().markPendingBottomPersistence();
      rendered.result().handleScrollEnd();
    });

    expect(latestConversationView.current).toEqual({ kind: "bottom" });
    expect(persistConversationView).toHaveBeenCalledWith({ kind: "bottom" });

    state.atBottom = false;

    act(() => {
      rendered.result().scheduleScrollCommand({
        align: "center",
        kind: "post",
        postId: targetPostId,
      });
    });

    expect(handle.scrollToIndex).toHaveBeenCalledWith(1, {
      align: "center",
      offset: undefined,
      smooth: undefined,
    });

    act(() => {
      rendered.result().resetPendingBottomPersistence();
      rendered.result().clearScrollCommand();
      rendered.result().resetScrollState();
    });
  });

  it("requests history only from valid edge gestures and cancels reads otherwise", () => {
    const cancelPendingMarkRead = vi.fn();
    const loadNewerPosts = vi.fn();
    const loadOlderPosts = vi.fn();
    const scheduleMarkRead = vi.fn();
    const { handle, state } = createScrollHandle({
      distanceFromBottom: 800,
      offset: 700,
    });
    const rendered = renderUseScroll(
      createUseScrollProps({
        cancelPendingMarkRead,
        hasMoreAfter: true,
        hasMoreBefore: false,
        loadNewerPosts,
        loadOlderPosts,
        scheduleMarkRead,
        scrollRef: { current: handle },
      })
    );

    act(() => {
      rendered.result().handleScroll(500);
    });

    expect(loadOlderPosts).not.toHaveBeenCalled();

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    state.offset = 550;

    act(() => {
      rendered.result().handleScroll(550);
    });

    expect(loadOlderPosts).not.toHaveBeenCalled();
    state.distanceFromBottom = 40;
    state.offset = 750;

    rendered.render(
      createUseScrollProps({
        cancelPendingMarkRead,
        hasMoreAfter: true,
        hasMoreBefore: false,
        isAtLatestEdge: true,
        loadNewerPosts,
        loadOlderPosts,
        scheduleMarkRead,
        scrollRef: { current: handle },
      })
    );

    act(() => {
      rendered.result().handleScroll(750);
    });

    expect(loadNewerPosts).toHaveBeenCalledTimes(1);
    expect(scheduleMarkRead).toHaveBeenCalled();

    rendered.render(
      createUseScrollProps({
        cancelPendingMarkRead,
        hasMoreAfter: false,
        hasMoreBefore: false,
        isAtLatestEdge: false,
        loadNewerPosts,
        loadOlderPosts,
        scheduleMarkRead,
        scrollRef: { current: handle },
      })
    );

    state.offset = 790;

    act(() => {
      rendered.result().handleScroll(790);
    });

    expect(loadNewerPosts).toHaveBeenCalledTimes(1);
    expect(cancelPendingMarkRead).toHaveBeenCalled();
  });

  it("notifies the controller only after navigation settles", () => {
    const onNavigationSettled = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        onNavigationSettled,
      })
    );

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    expect(onNavigationSettled).toHaveBeenCalledTimes(1);

    act(() => {
      rendered.result().handleScrollEnd();
    });

    expect(onNavigationSettled).toHaveBeenCalledTimes(2);
  });

  it("flushes read state only for a fresh latest post near the live bottom", () => {
    const flushMarkRead = vi.fn();
    const { handle, state } = createScrollHandle({
      atBottom: false,
      distanceFromBottom: 200,
      offset: 100,
    });
    const rendered = renderUseScroll(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        lastPostId: "post_1" as Id<"schoolClassForumPosts">,
        scrollRef: { current: handle },
      })
    );

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    rendered.render(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        lastPostId: "post_1" as Id<"schoolClassForumPosts">,
        scrollRef: { current: handle },
      })
    );

    rendered.render(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        lastPostId: "post_2" as Id<"schoolClassForumPosts">,
        scrollRef: { current: handle },
      })
    );

    expect(flushMarkRead).not.toHaveBeenCalled();

    state.distanceFromBottom = 10;

    rendered.render(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        lastPostId: "post_3" as Id<"schoolClassForumPosts">,
        scrollRef: { current: handle },
      })
    );

    expect(flushMarkRead).toHaveBeenCalledWith(
      "post_3" as Id<"schoolClassForumPosts">
    );
  });

  it("skips live read flushing when no scroll handle is available", () => {
    const flushMarkRead = vi.fn();
    const rendered = renderUseScroll(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        lastPostId: "post_1" as Id<"schoolClassForumPosts">,
        scrollRef: { current: null },
      })
    );

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    rendered.render(
      createUseScrollProps({
        flushMarkRead,
        isAtLatestEdge: true,
        lastPostId: "post_2" as Id<"schoolClassForumPosts">,
        scrollRef: { current: null },
      })
    );

    expect(flushMarkRead).not.toHaveBeenCalled();
  });

  it("leaves the session hidden when neither capture nor fallback view resolves", async () => {
    vi.resetModules();
    vi.doMock(
      "@/components/school/classes/forum/conversation/utils/view",
      async () => {
        const actual = await vi.importActual<
          typeof import("@/components/school/classes/forum/conversation/utils/view")
        >("@/components/school/classes/forum/conversation/utils/view");

        return {
          ...actual,
          createInitialConversationView: vi.fn(() => null),
        };
      }
    );

    const { useScroll: mockedUseScroll } = await import(
      "@/components/school/classes/forum/conversation/hooks/use-scroll"
    );
    const persistConversationView = vi.fn();
    const rendered = renderUseScrollWithHook(
      mockedUseScroll,
      createUseScrollProps({
        captureCurrentConversationView: vi.fn(() => null),
        persistConversationView,
      })
    );

    act(() => {
      rendered.result().handleVirtualAnchorReady();
    });

    expect(persistConversationView).not.toHaveBeenCalled();
    expect(rendered.result().isConversationRevealed).toBe(true);

    vi.doUnmock("@/components/school/classes/forum/conversation/utils/view");
    vi.resetModules();
  });
});
