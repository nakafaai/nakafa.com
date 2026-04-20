import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForumPostConversation } from "@/components/school/classes/forum/conversation/index";

const mocks = vi.hoisted(() => ({
  conversation: null as null | {
    actions: Record<string, unknown>;
    meta: Record<string, unknown>;
    state: {
      canGoBack: boolean;
      forum: { _id: Id<"schoolClassForums"> } | undefined;
      isAtBottom: boolean;
      isAtLatestEdge: boolean;
      isInitialLoading: boolean;
      items: Array<{ type: string }>;
    };
  },
}));

vi.mock("@/components/school/classes/forum/conversation/provider", () => ({
  ConversationProvider: ({
    children,
    forum,
  }: {
    children: React.ReactNode;
    forum: { _id: Id<"schoolClassForums"> } | undefined;
  }) => {
    if (!mocks.conversation) {
      throw new Error("Expected mocked conversation state.");
    }

    mocks.conversation = {
      ...mocks.conversation,
      state: {
        ...mocks.conversation.state,
        forum,
      },
    };

    return createElement("div", null, children);
  },
  useConversation: (
    selector: (value: NonNullable<typeof mocks.conversation>) => unknown
  ) => {
    if (!mocks.conversation) {
      throw new Error("Expected mocked conversation state.");
    }

    return selector(mocks.conversation);
  },
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

function createConversationModelResult(overrides?: {
  canGoBack?: boolean;
  isAtBottom?: boolean;
  isAtLatestEdge?: boolean;
  isInitialLoading?: boolean;
  items?: Array<{ type: string }>;
}) {
  return {
    actions: {
      goBack: vi.fn(),
      scrollToLatest: vi.fn(),
    },
    meta: {
      currentUserId,
      forumId,
    },
    state: {
      canGoBack: overrides?.canGoBack ?? false,
      forum: { _id: forumId },
      isAtBottom: overrides?.isAtBottom ?? false,
      isAtLatestEdge: overrides?.isAtLatestEdge ?? true,
      isInitialLoading: overrides?.isInitialLoading ?? false,
      items: overrides?.items ?? [],
    },
  };
}

function renderConversation({ forum }: { forum: any }) {
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
    mocks.conversation = null;
  });

  it("shows the placeholder while the transcript is still loading", () => {
    mocks.conversation = createConversationModelResult({
      isInitialLoading: true,
    });

    const { container, root } = renderConversation({ forum: { _id: forumId } });

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
    mocks.conversation = createConversationModelResult();

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
    mocks.conversation = createConversationModelResult();

    const { container, root } = renderConversation({ forum: { _id: forumId } });
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
    mocks.conversation = createConversationModelResult({
      canGoBack: true,
      isAtBottom: false,
      isAtLatestEdge: false,
      items: [{ type: "post" }],
    });

    const { container, root } = renderConversation({ forum: { _id: forumId } });

    const jumpBar = container.querySelector('[data-testid="jump-bar"]');

    expect(jumpBar).not.toBeNull();
    expect(jumpBar?.getAttribute("data-show-back")).toBe("true");
    expect(jumpBar?.getAttribute("data-show-latest")).toBe("true");
    expect(
      container.querySelector('[data-testid="virtual-conversation"]')
    ).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows only the latest action while detached without back-stack history", () => {
    mocks.conversation = createConversationModelResult({
      canGoBack: false,
      isAtBottom: false,
      isAtLatestEdge: true,
      items: [{ type: "post" }],
    });

    const { container, root } = renderConversation({ forum: { _id: forumId } });

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
    mocks.conversation = createConversationModelResult({
      canGoBack: true,
      isAtBottom: true,
      isAtLatestEdge: true,
      items: [{ type: "post" }],
    });

    const { container, root } = renderConversation({ forum: { _id: forumId } });

    expect(container.querySelector('[data-testid="jump-bar"]')).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
