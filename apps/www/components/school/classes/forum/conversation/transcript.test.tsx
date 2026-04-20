import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForumConversationTranscript } from "@/components/school/classes/forum/conversation/transcript";
import type {
  ConversationTranscriptCommand,
  Forum,
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import type { ForumConversationView } from "@/lib/store/forum";

const conversationMock = vi.hoisted(() => ({
  value: null as null | {
    actions: {
      cancelPendingMarkRead: ReturnType<typeof vi.fn>;
      flushMarkRead: ReturnType<typeof vi.fn>;
      handleBottomStateChange: ReturnType<typeof vi.fn>;
      handleCommandResult: ReturnType<typeof vi.fn>;
      handleHighlightVisiblePost: ReturnType<typeof vi.fn>;
      handleSettledView: ReturnType<typeof vi.fn>;
      loadNewerPosts: ReturnType<typeof vi.fn>;
      loadOlderPosts: ReturnType<typeof vi.fn>;
      scheduleMarkRead: ReturnType<typeof vi.fn>;
    };
    meta: {
      currentUserId: Id<"users">;
      forumId: Id<"schoolClassForums">;
    };
    state: {
      command: ConversationTranscriptCommand | null;
      hasMoreAfter: boolean;
      hasMoreBefore: boolean;
      highlightedPostId: Id<"schoolClassForumPosts"> | null;
      isAtLatestEdge: boolean;
      isLoadingNewer: boolean;
      isLoadingOlder: boolean;
      items: VirtualItem[];
      lastPostId: Id<"schoolClassForumPosts"> | undefined;
      latestConversationView: ForumConversationView | null;
      mode:
        | { kind: "live" }
        | { kind: "jump"; postId: Id<"schoolClassForumPosts"> }
        | {
            kind: "restore";
            postId: Id<"schoolClassForumPosts">;
            view: Extract<ForumConversationView, { kind: "post" }>;
          };
      pendingHighlightPostId: Id<"schoolClassForumPosts"> | null;
      postIdToIndex: Map<Id<"schoolClassForumPosts">, number>;
      timelineSessionVersion: number;
      unreadPostId: Id<"schoolClassForumPosts"> | null;
    };
  },
}));

const virtualizerMock = vi.hoisted(() => ({
  instance: null as {
    getOffsetForIndex: (
      index: number,
      align?: "auto" | "center" | "end" | "start"
    ) => readonly [number, "auto" | "center" | "end" | "start"] | undefined;
    getTotalSize: () => number;
    getVirtualItems: () => Array<{
      end: number;
      index: number;
      key: string;
      size: number;
      start: number;
    }>;
    measureElement: (element: HTMLDivElement | null) => void;
    scrollOffset: number;
    scrollRect: { height: number };
    scrollToIndex: (
      index: number,
      options?: {
        align?: "auto" | "center" | "end" | "start";
        behavior?: "auto" | "smooth";
      }
    ) => void;
    scrollToOffset: (
      offset: number,
      options?: { behavior?: "auto" | "smooth" }
    ) => void;
  } | null,
  measurements: [] as Array<{
    end: number;
    index: number;
    key: string;
    size: number;
    start: number;
  }>,
  onChange: null as null | ((instance: any, sync: boolean) => void),
  scrollOffset: 0,
  scrollRect: { height: 400 },
  scrollToIndex: vi.fn(),
  scrollToOffset: vi.fn((offset: number) => {
    virtualizerMock.scrollOffset = offset;
  }),
  totalSize: 1200,
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: any) => {
    virtualizerMock.onChange = options.onChange;
    virtualizerMock.instance = {
      getOffsetForIndex: (index, align = "auto") => {
        const item = virtualizerMock.measurements[index];

        if (!item) {
          return;
        }

        if (align === "center") {
          return [
            Math.max(
              0,
              item.start - (virtualizerMock.scrollRect.height - item.size) / 2
            ),
            align,
          ] as const;
        }

        return [item.start, align === "auto" ? "start" : align] as const;
      },
      getTotalSize: () => virtualizerMock.totalSize,
      getVirtualItems: () => virtualizerMock.measurements,
      measureElement: () => {
        // The test double does not need DOM measurement side effects.
      },
      scrollOffset: virtualizerMock.scrollOffset,
      scrollRect: virtualizerMock.scrollRect,
      scrollToIndex: (index, options) => {
        virtualizerMock.scrollToIndex(index, options);
      },
      scrollToOffset: (offset, _options) => {
        virtualizerMock.scrollOffset = offset;
        virtualizerMock.scrollToOffset(offset);
      },
    };

    return virtualizerMock.instance;
  },
}));

vi.mock("@/components/school/classes/forum/conversation/header", () => ({
  ForumHeader: () => createElement("div", { "data-testid": "forum-header" }),
}));

vi.mock("@/components/school/classes/forum/conversation/item", () => ({
  ForumPostItem: ({ post }: { post: ForumPost }) =>
    createElement("div", {
      "data-post-id": post._id,
      "data-testid": "forum-post-item",
    }),
}));

vi.mock("@/components/school/classes/forum/conversation/separators", () => ({
  DateSeparator: () =>
    createElement("div", { "data-testid": "date-separator" }),
  UnreadSeparator: () =>
    createElement("div", { "data-testid": "unread-separator" }),
}));

vi.mock("@/components/school/classes/forum/conversation/provider", () => ({
  useConversation: (
    selector: (value: NonNullable<typeof conversationMock.value>) => unknown
  ) => {
    if (!conversationMock.value) {
      throw new Error("Expected mocked conversation state.");
    }

    return selector(conversationMock.value);
  },
}));

const mountedRoots: Array<() => void> = [];
const forumId = "forum_1" as Id<"schoolClassForums">;
const userId = "user_1" as Id<"users">;

function createForum(): Forum {
  const createdTime = Date.UTC(2026, 3, 20, 10, 0, 0);

  return {
    _creationTime: createdTime,
    _id: forumId,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: userId,
    isPinned: false,
    lastPostAt: createdTime,
    lastPostBy: userId,
    myReactions: [],
    nextPostSequence: 2,
    postCount: 1,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: "school_1" as Id<"schools">,
    status: "open",
    tag: "general",
    title: "Forum title",
    updatedAt: createdTime,
    user: null,
  } satisfies Forum;
}

function createPost(id: string, createdTime: number): ForumPost {
  return {
    _creationTime: createdTime,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: userId,
    forumId,
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
    updatedAt: createdTime,
    user: null,
  } satisfies ForumPost;
}

function createItems(postIds: string[]): VirtualItem[] {
  const createdTime = Date.UTC(2026, 3, 20, 10, 0, 0);

  return [
    { forum: createForum(), type: "header" },
    ...postIds.map((postId, index) => ({
      isFirstInGroup: true,
      isLastInGroup: true,
      post: createPost(postId, createdTime + index * 60_000),
      showContinuationTime: false,
      type: "post" as const,
    })),
  ];
}

function createMeasurements(items: VirtualItem[], starts: number[]) {
  return items.map((item, index) => ({
    end: (starts[index] ?? 0) + (item.type === "post" ? 80 : 60),
    index,
    key: item.type === "post" ? item.post._id : `${item.type}:${index}`,
    size: item.type === "post" ? 80 : 60,
    start: starts[index] ?? 0,
  }));
}

function createValue(overrides?: {
  command?: ConversationTranscriptCommand | null;
  hasMoreBefore?: boolean;
  isAtLatestEdge?: boolean;
  isLoadingOlder?: boolean;
  items?: VirtualItem[];
  latestConversationView?: ForumConversationView | null;
  mode?:
    | { kind: "live" }
    | { kind: "jump"; postId: Id<"schoolClassForumPosts"> }
    | {
        kind: "restore";
        postId: Id<"schoolClassForumPosts">;
        view: Extract<ForumConversationView, { kind: "post" }>;
      };
  pendingHighlightPostId?: Id<"schoolClassForumPosts"> | null;
  timelineSessionVersion?: number;
}) {
  const items = overrides?.items ?? createItems(["post_1", "post_2"]);

  return {
    actions: {
      cancelPendingMarkRead: vi.fn(),
      flushMarkRead: vi.fn(),
      handleBottomStateChange: vi.fn(),
      handleCommandResult: vi.fn(),
      handleHighlightVisiblePost: vi.fn(),
      handleSettledView: vi.fn(),
      loadNewerPosts: vi.fn(),
      loadOlderPosts: vi.fn(),
      scheduleMarkRead: vi.fn(),
    },
    meta: {
      currentUserId: userId,
      forumId,
    },
    state: {
      command: overrides?.command ?? null,
      hasMoreAfter: false,
      hasMoreBefore: overrides?.hasMoreBefore ?? false,
      highlightedPostId: null,
      isAtLatestEdge: overrides?.isAtLatestEdge ?? true,
      isLoadingNewer: false,
      isLoadingOlder: overrides?.isLoadingOlder ?? false,
      items,
      lastPostId: [...items].reverse().find((item) => item.type === "post")
        ?.post._id,
      latestConversationView: overrides?.latestConversationView ?? null,
      mode: overrides?.mode ?? ({ kind: "live" } as const),
      pendingHighlightPostId: overrides?.pendingHighlightPostId ?? null,
      postIdToIndex: new Map(
        items.flatMap((item, index) =>
          item.type === "post" ? [[item.post._id, index] as const] : []
        )
      ),
      timelineSessionVersion: overrides?.timelineSessionVersion ?? 0,
      unreadPostId: null,
    },
  };
}

function renderTranscript(initialValue: ReturnType<typeof createValue>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let currentValue = initialValue;
  conversationMock.value = currentValue;

  act(() => {
    root.render(createElement(ForumConversationTranscript));
  });

  const rerender = (nextValue: typeof initialValue) => {
    currentValue = nextValue;
    conversationMock.value = currentValue;

    act(() => {
      root.render(createElement(ForumConversationTranscript));
    });
  };

  mountedRoots.push(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  return {
    container,
    rerender,
  };
}

function emitVirtualizerChange(sync: boolean) {
  if (!(virtualizerMock.instance && virtualizerMock.onChange)) {
    throw new Error("Expected virtualizer instance to exist.");
  }

  virtualizerMock.instance.scrollOffset = virtualizerMock.scrollOffset;
  act(() => {
    virtualizerMock.onChange?.(virtualizerMock.instance, sync);
  });
}

describe("conversation/transcript", () => {
  afterEach(() => {
    vi.clearAllMocks();
    conversationMock.value = null;
    virtualizerMock.instance = null;
    virtualizerMock.measurements = [];
    virtualizerMock.onChange = null;
    virtualizerMock.scrollOffset = 0;
    virtualizerMock.scrollToIndex.mockReset();
    virtualizerMock.totalSize = 1200;

    while (mountedRoots.length > 0) {
      mountedRoots.pop()?.();
    }
  });

  it("restores a saved post view once the target post is loaded", () => {
    const items = createItems(["post_1", "post_2"]);
    const savedView = {
      kind: "post",
      offset: 24,
      postId: "post_2" as Id<"schoolClassForumPosts">,
    } satisfies Extract<ForumConversationView, { kind: "post" }>;

    virtualizerMock.measurements = createMeasurements(items, [0, 60, 160]);

    renderTranscript(
      createValue({
        items,
        latestConversationView: savedView,
        mode: {
          kind: "restore",
          postId: savedView.postId,
          view: savedView,
        },
        timelineSessionVersion: 1,
      })
    );

    expect(virtualizerMock.scrollToOffset).toHaveBeenCalledWith(136);
  });

  it("wraps measured rows in a flow-root container so post margins stay inside the virtual item", () => {
    const items = createItems(["post_1", "post_2"]);
    virtualizerMock.measurements = createMeasurements(items, [0, 60, 160]);

    const { container } = renderTranscript(
      createValue({
        items,
      })
    );

    const measuredRow = container.querySelector("[data-index='1']");

    expect(measuredRow?.getAttribute("class")).toContain("flow-root");
    expect(measuredRow?.getAttribute("class")).toContain("w-full");
  });

  it("keeps the visible anchor fixed after older history prepends", () => {
    const initialItems = createItems(["post_1", "post_2"]);
    virtualizerMock.measurements = createMeasurements(
      initialItems,
      [0, 20, 160]
    );
    virtualizerMock.scrollOffset = 30;
    const value = createValue({
      hasMoreBefore: true,
      items: initialItems,
    });

    const { rerender } = renderTranscript(value);
    virtualizerMock.scrollOffset = 120;
    emitVirtualizerChange(true);

    virtualizerMock.scrollOffset = 30;
    emitVirtualizerChange(true);

    expect(value.actions.loadOlderPosts).toHaveBeenCalledTimes(1);

    const loadingProps = {
      ...value,
      state: {
        ...value.state,
        isLoadingOlder: true,
      },
    };

    rerender(loadingProps);

    const prependedItems = createItems([
      "post_a",
      "post_b",
      "post_1",
      "post_2",
    ]);
    virtualizerMock.measurements = createMeasurements(
      prependedItems,
      [0, 100, 220, 300, 440]
    );

    rerender(
      createValue({
        hasMoreBefore: true,
        isLoadingOlder: false,
        items: prependedItems,
      })
    );

    expect(virtualizerMock.scrollToOffset).toHaveBeenLastCalledWith(310);
  });

  it("waits for the live latest edge before applying an explicit latest command", () => {
    const savedView = {
      kind: "post",
      offset: 12,
      postId: "post_1" as Id<"schoolClassForumPosts">,
    } satisfies Extract<ForumConversationView, { kind: "post" }>;
    const value = createValue({
      isAtLatestEdge: false,
      latestConversationView: savedView,
      mode: {
        kind: "restore",
        postId: savedView.postId,
        view: savedView,
      },
    });

    virtualizerMock.measurements = createMeasurements(
      value.state.items,
      [0, 60, 160]
    );
    const { rerender } = renderTranscript(value);

    virtualizerMock.scrollToOffset.mockClear();

    rerender({
      ...value,
      state: {
        ...value.state,
        command: {
          id: 1,
          kind: "latest",
          smooth: false,
        } satisfies ConversationTranscriptCommand,
      },
    });

    expect(virtualizerMock.scrollToOffset).not.toHaveBeenCalled();
    expect(value.actions.handleCommandResult).not.toHaveBeenCalled();

    rerender({
      ...value,
      state: {
        ...value.state,
        command: {
          id: 1,
          kind: "latest",
          smooth: false,
        } satisfies ConversationTranscriptCommand,
        isAtLatestEdge: true,
      },
    });

    expect(virtualizerMock.scrollToIndex).toHaveBeenCalledWith(
      value.state.items.length - 1,
      {
        align: "end",
        behavior: "auto",
      }
    );
    expect(value.actions.handleCommandResult).toHaveBeenCalledWith({
      id: 1,
      status: "scrolled",
    });
  });

  it("highlights a jumped post immediately when the target is already visible", () => {
    const items = createItems(["post_1", "post_2"]);
    const value = createValue({
      command: {
        id: 1,
        kind: "jump",
        postId: "post_1" as Id<"schoolClassForumPosts">,
        smooth: false,
      },
      items,
      mode: {
        kind: "jump",
        postId: "post_1" as Id<"schoolClassForumPosts">,
      },
      pendingHighlightPostId: "post_1" as Id<"schoolClassForumPosts">,
    });

    virtualizerMock.measurements = createMeasurements(items, [0, 60, 160]);
    virtualizerMock.scrollOffset = 0;

    renderTranscript(value);

    expect(value.actions.handleHighlightVisiblePost).toHaveBeenCalledWith(
      "post_1"
    );
    expect(value.actions.handleCommandResult).toHaveBeenCalledWith({
      id: 1,
      status: "scrolled",
    });
  });
});
