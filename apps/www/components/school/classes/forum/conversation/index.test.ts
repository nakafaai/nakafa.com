import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation/index";
import type {
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";

const mocks = vi.hoisted(() => ({
  useController: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@repo/design-system/components/ui/virtual-conversation", () => ({
  VirtualConversation: ({
    children,
    floatingContent,
  }: {
    children: ReactNode;
    floatingContent?: ReactNode;
  }) =>
    createElement(
      "div",
      { "data-testid": "virtual-conversation" },
      floatingContent,
      children
    ),
  VirtualConversationPlaceholder: () =>
    createElement("div", { "data-testid": "virtual-conversation-placeholder" }),
}));

vi.mock(
  "@/components/school/classes/forum/conversation/hooks/use-controller",
  () => ({
    useController: mocks.useController,
  })
);

vi.mock("@/components/school/classes/forum/conversation/input", () => ({
  ForumPostInput: () => createElement("div", { "data-testid": "forum-input" }),
}));

vi.mock("@/components/school/classes/forum/conversation/header", () => ({
  ForumHeader: () => createElement("div", { "data-testid": "forum-header" }),
}));

vi.mock("@/components/school/classes/forum/conversation/item", () => ({
  ForumPostItem: ({ isJumpHighlighted }: { isJumpHighlighted: boolean }) =>
    createElement("div", {
      "data-jump-highlighted": String(isJumpHighlighted),
      "data-testid": "forum-post-item",
    }),
}));

vi.mock("@/components/school/classes/forum/conversation/jump-bar", () => ({
  JumpBar: () => createElement("div", { "data-testid": "jump-bar" }),
}));

vi.mock("@/components/school/classes/forum/conversation/separators", () => ({
  DateSeparator: () =>
    createElement("div", { "data-testid": "date-separator" }),
  UnreadSeparator: () =>
    createElement("div", { "data-testid": "unread-separator" }),
}));

const forumId = "forum_1" as Id<"schoolClassForums">;
const currentUserId = "user_1" as Id<"users">;

/** Creates one minimal controller result for conversation render tests. */
function createControllerResult(overrides?: {
  canGoBack?: boolean;
  highlightedPostId?: Id<"schoolClassForumPosts"> | null;
  isAtBottom?: boolean;
  isConversationRevealed?: boolean;
  isInitialLoading?: boolean;
  items?: VirtualItem[];
}) {
  return {
    acknowledgeUnreadCue: vi.fn(),
    canGoBack: overrides?.canGoBack ?? false,
    forumScrollValue: {
      jumpToPostId: vi.fn(),
      scrollToLatest: vi.fn(),
    },
    goBack: vi.fn(),
    handleScroll: vi.fn(),
    handleScrollEnd: vi.fn(),
    handleVirtualAnchorReady: vi.fn(),
    highlightedPostId: overrides?.highlightedPostId ?? null,
    initialAnchor: { kind: "bottom" as const },
    isAtBottom: overrides?.isAtBottom ?? false,
    isAtLatestEdge: true,
    isConversationRevealed: overrides?.isConversationRevealed ?? false,
    isInitialLoading: overrides?.isInitialLoading ?? false,
    isPrepending: false,
    items: overrides?.items ?? [],
    scrollRef: { current: null },
    scrollToLatest: vi.fn(),
    timelineSessionVersion: 0,
  };
}

/** Creates one minimal forum object for render gating tests. */
function createForum(): Forum {
  return {
    _creationTime: Date.UTC(2026, 3, 20, 10, 0, 0),
    _id: forumId,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: currentUserId,
    isPinned: false,
    lastPostAt: Date.UTC(2026, 3, 20, 10, 0, 0),
    lastPostBy: currentUserId,
    myReactions: [],
    nextPostSequence: 2,
    postCount: 1,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: "school_1" as Id<"schools">,
    status: "open",
    tag: "general",
    title: "Forum title",
    updatedAt: Date.UTC(2026, 3, 20, 10, 0, 0),
    user: null,
  } satisfies Forum;
}

/** Renders the conversation once and returns the mounted DOM container. */
function renderConversation({
  forum,
}: {
  forum: ReturnType<typeof createForum> | undefined;
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(ForumPostConversation, {
        currentUserId,
        forum,
        forumId,
      })
    );
  });

  return { container, root };
}

describe("conversation/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the placeholder while the transcript is still loading", () => {
    mocks.useController.mockReturnValue(
      createControllerResult({ isInitialLoading: true })
    );

    const { container, root } = renderConversation({ forum: createForum() });

    expect(
      container.querySelector(
        '[data-testid="virtual-conversation-placeholder"]'
      )
    ).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows the placeholder while the forum metadata is missing", () => {
    mocks.useController.mockReturnValue(createControllerResult());

    const { container, root } = renderConversation({ forum: undefined });

    expect(
      container.querySelector(
        '[data-testid="virtual-conversation-placeholder"]'
      )
    ).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the real conversation shell hidden until the controller reveals it", () => {
    mocks.useController.mockReturnValue(
      createControllerResult({ isConversationRevealed: false })
    );

    const { container, root } = renderConversation({ forum: createForum() });

    expect(
      container.querySelector('[data-testid="virtual-conversation"]')
    ).not.toBeNull();
    expect(container.firstElementChild?.className).toContain("invisible");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("reveals the real conversation shell once the controller is ready", () => {
    mocks.useController.mockReturnValue(
      createControllerResult({ isConversationRevealed: true })
    );

    const { container, root } = renderConversation({ forum: createForum() });

    expect(
      container.querySelector('[data-testid="virtual-conversation"]')
    ).not.toBeNull();
    expect(container.firstElementChild?.className).not.toContain("invisible");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders jump actions and each semantic conversation item", () => {
    const highlightedPostId = "post_1" as Id<"schoolClassForumPosts">;

    mocks.useController.mockReturnValue(
      createControllerResult({
        canGoBack: true,
        highlightedPostId,
        isConversationRevealed: true,
        items: [
          { forum: createForum(), type: "header" },
          { date: Date.UTC(2026, 3, 20, 0, 0, 0), type: "date" },
          { count: 2, status: "new", type: "unread" },
          {
            isFirstInGroup: true,
            isLastInGroup: true,
            post: { _id: highlightedPostId },
            showContinuationTime: false,
            type: "post",
          } as VirtualItem,
        ],
      })
    );

    const { container, root } = renderConversation({ forum: createForum() });

    expect(container.querySelector('[data-testid="jump-bar"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="forum-header"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="date-separator"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="unread-separator"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="forum-post-item"]')
    ).not.toBeNull();
    expect(
      container
        .querySelector('[data-testid="forum-post-item"]')
        ?.getAttribute("data-jump-highlighted")
    ).toBe("true");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
