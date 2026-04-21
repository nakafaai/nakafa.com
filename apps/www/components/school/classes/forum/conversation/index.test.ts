import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation/index";
import type { Forum } from "@/components/school/classes/forum/conversation/types";

type ConversationForum = Forum | undefined;

/** Creates one minimal forum payload for conversation shell tests. */
function createForum(): Forum {
  const createdTime = Date.UTC(2026, 3, 21, 10, 0, 0);

  return {
    _creationTime: createdTime,
    _id: "forum_1" as Id<"schoolClassForums">,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: "user_1" as Id<"users">,
    isPinned: false,
    lastPostAt: createdTime,
    lastPostBy: "user_1" as Id<"users">,
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

const conversationState = vi.hoisted(() => ({
  value: {
    canGoBack: false,
    currentUserId: "user_1" as Id<"users">,
    forum: createForum() as ConversationForum,
    forumId: "forum_1" as Id<"schoolClassForums">,
    hasPendingLatestPosts: false,
    isAtBottom: false,
    isAtLatestEdge: true,
    isInitialLoading: false,
  },
}));

vi.mock("@/components/school/classes/forum/conversation/provider", () => ({
  ConversationProvider: ({
    children,
    forum,
  }: {
    children: React.ReactNode;
    forum: ConversationForum;
  }) => {
    conversationState.value = {
      ...conversationState.value,
      forum,
    };

    return createElement("div", null, children);
  },
  useConversation: (
    selector: (value: typeof conversationState.value) => unknown
  ) => selector(conversationState.value),
}));

vi.mock("@/components/school/classes/forum/conversation/transcript", () => ({
  ForumConversationTranscript: () =>
    createElement("div", {
      "data-testid": "virtual-conversation",
    }),
  ForumConversationTranscriptPlaceholder: () =>
    createElement("div", {
      "data-testid": "virtual-conversation-placeholder",
    }),
}));

vi.mock("@/components/school/classes/forum/conversation/input", () => ({
  ForumPostInput: () => createElement("div", { "data-testid": "forum-input" }),
}));

vi.mock("@/components/school/classes/forum/conversation/jump-bar", () => ({
  JumpBar: ({
    showBack,
    showLatest,
  }: {
    showBack: boolean;
    showLatest: boolean;
  }) => {
    if (!(showBack || showLatest)) {
      return null;
    }

    return createElement("div", {
      "data-show-back": String(showBack),
      "data-show-latest": String(showLatest),
      "data-testid": "jump-bar",
    });
  },
}));

const forumId = "forum_1" as Id<"schoolClassForums">;
const currentUserId = "user_1" as Id<"users">;

/** Mounts the conversation shell once and returns the detached DOM container. */
function renderConversation({ forum }: { forum: ConversationForum }) {
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
    conversationState.value = {
      ...conversationState.value,
      canGoBack: false,
      forum: createForum(),
      hasPendingLatestPosts: false,
      isAtBottom: false,
      isAtLatestEdge: true,
      isInitialLoading: false,
    };
  });

  it("shows the placeholder while the transcript is still loading", () => {
    conversationState.value = {
      ...conversationState.value,
      isInitialLoading: true,
    };

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

  it("renders the transcript shell and input once the conversation is ready", () => {
    const { container, root } = renderConversation({ forum: createForum() });
    const transcript = container.querySelector(
      '[data-testid="virtual-conversation"]'
    );
    const transcriptShell = transcript?.parentElement;

    expect(transcript).not.toBeNull();
    expect(transcriptShell?.getAttribute("class")).toContain("relative");
    expect(transcriptShell?.getAttribute("class")).toContain("flex-1");
    expect(transcriptShell?.getAttribute("class")).toContain("overflow-hidden");
    expect(
      container.querySelector('[data-testid="forum-input"]')
    ).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows both jump actions while detached with back-stack history", () => {
    conversationState.value = {
      ...conversationState.value,
      canGoBack: true,
      hasPendingLatestPosts: true,
      isAtBottom: false,
      isAtLatestEdge: false,
    };

    const { container, root } = renderConversation({ forum: createForum() });

    const jumpBar = container.querySelector('[data-testid="jump-bar"]');

    expect(jumpBar).not.toBeNull();
    expect(jumpBar?.getAttribute("data-show-back")).toBe("true");
    expect(jumpBar?.getAttribute("data-show-latest")).toBe("true");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows only the latest action while detached without back-stack history", () => {
    conversationState.value = {
      ...conversationState.value,
      canGoBack: false,
      hasPendingLatestPosts: false,
      isAtBottom: false,
      isAtLatestEdge: false,
    };

    const { container, root } = renderConversation({ forum: createForum() });

    const jumpBar = container.querySelector('[data-testid="jump-bar"]');

    expect(jumpBar).not.toBeNull();
    expect(jumpBar?.getAttribute("data-show-back")).toBe("false");
    expect(jumpBar?.getAttribute("data-show-latest")).toBe("true");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("hides jump controls once the conversation is already at latest bottom", () => {
    conversationState.value = {
      ...conversationState.value,
      canGoBack: true,
      hasPendingLatestPosts: false,
      isAtBottom: true,
      isAtLatestEdge: true,
    };

    const { container, root } = renderConversation({ forum: createForum() });

    expect(container.querySelector('[data-testid="jump-bar"]')).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
