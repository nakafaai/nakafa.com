import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ForumConversationTranscript,
  ForumConversationTranscriptPlaceholder,
} from "@/components/school/classes/forum/conversation/transcript";
import type {
  ConversationTranscriptCommand,
  Forum,
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";

const conversationState = vi.hoisted(() => ({
  clearScrollRequest: vi.fn(),
  forumId: "forum_1" as Id<"schoolClassForums">,
  handleBottomStateChange: vi.fn(),
  handleHighlightVisiblePost: vi.fn(),
  handleSettledView: vi.fn(),
  hasMoreAfter: false,
  hasMoreBefore: false,
  highlightedPostId: null as Id<"schoolClassForumPosts"> | null,
  isAtBottom: false,
  isAtLatestEdge: false,
  isLoadingNewer: false,
  isLoadingOlder: false,
  items: [] as VirtualItem[],
  lastPostId: undefined as Id<"schoolClassForumPosts"> | undefined,
  loadNewerPosts: vi.fn(),
  loadOlderPosts: vi.fn(),
  pendingHighlightPostId: null as Id<"schoolClassForumPosts"> | null,
  postIdToIndex: new Map<Id<"schoolClassForumPosts">, number>(),
  scrollRequest: null as ConversationTranscriptCommand | null,
  timelineSessionVersion: 0,
  transcriptVariant: "live" as const,
}));

vi.mock("@mantine/hooks", () => ({
  useDebouncedCallback: <Args extends unknown[]>(
    callback: (...args: Args) => void
  ) =>
    Object.assign(callback, {
      cancel: vi.fn(),
      flush: vi.fn(),
    }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(() => Promise.resolve()),
}));

vi.mock("virtua", () => ({
  Virtualizer: ({
    children,
    data,
  }: {
    children: (item: VirtualItem, index: number) => React.ReactNode;
    data: VirtualItem[];
  }) =>
    createElement(
      "div",
      { "data-testid": "virtua-virtualizer" },
      data.map((item, index) => children(item, index))
    ),
}));

vi.mock("@/components/school/classes/forum/conversation/provider", () => ({
  useConversation: (selector: (value: typeof conversationState) => unknown) =>
    selector(conversationState),
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

const mountedRoots: Array<() => void> = [];
const forumId = "forum_1" as Id<"schoolClassForums">;
const userId = "user_1" as Id<"users">;
const animationFrames: FrameRequestCallback[] = [];
const clientHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientHeight"
);
const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollHeight"
);
const scrollToDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollTo"
);

/** Creates one minimal forum thread payload for transcript row tests. */
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

/** Creates one minimal forum post payload for transcript row tests. */
function createPost(id: string): ForumPost {
  const createdTime = Date.UTC(2026, 3, 20, 10, 0, 0);

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

/** Mounts the transcript shell once and returns the detached DOM container. */
function render(element: React.ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);

  document.body.append(container);

  act(() => {
    root.render(element);
  });

  mountedRoots.push(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  return container;
}

/** Flushes every queued animation frame used by transcript settle retries. */
function flushAnimationFrames() {
  while (animationFrames.length > 0) {
    const callbacks = animationFrames.splice(0, animationFrames.length);

    for (const callback of callbacks) {
      callback(performance.now());
    }
  }
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.();
  }

  vi.restoreAllMocks();
  vi.unstubAllGlobals();

  if (clientHeightDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientHeight",
      clientHeightDescriptor
    );
  }

  if (scrollHeightDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollHeight",
      scrollHeightDescriptor
    );
  }

  if (scrollToDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollTo",
      scrollToDescriptor
    );
  }
});

beforeEach(() => {
  animationFrames.length = 0;
  conversationState.clearScrollRequest.mockReset();
  conversationState.handleBottomStateChange.mockReset();
  conversationState.handleHighlightVisiblePost.mockReset();
  conversationState.handleSettledView.mockReset();
  conversationState.hasMoreAfter = false;
  conversationState.hasMoreBefore = false;
  conversationState.highlightedPostId = null;
  conversationState.isAtBottom = false;
  conversationState.isAtLatestEdge = false;
  conversationState.isLoadingNewer = false;
  conversationState.isLoadingOlder = false;
  conversationState.items = [];
  conversationState.lastPostId = undefined;
  conversationState.loadNewerPosts.mockReset();
  conversationState.loadOlderPosts.mockReset();
  conversationState.pendingHighlightPostId = null;
  conversationState.postIdToIndex = new Map();
  conversationState.scrollRequest = null;
  conversationState.timelineSessionVersion = 0;
  conversationState.transcriptVariant = "live";

  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    })
  );

  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value(this: HTMLElement, options?: ScrollToOptions) {
      if (typeof options?.top !== "number") {
        return;
      }

      Object.defineProperty(this, "scrollTop", {
        configurable: true,
        value: options.top,
        writable: true,
      });
    },
  });

  Object.defineProperties(HTMLElement.prototype, {
    clientHeight: {
      configurable: true,
      get() {
        return 400;
      },
    },
    scrollHeight: {
      configurable: true,
      get() {
        return 1000;
      },
    },
  });
});

describe("conversation/transcript", () => {
  it("renders the Virtua transcript shell and semantic rows", () => {
    conversationState.items = [
      { forum: createForum(), type: "header" },
      { date: Date.UTC(2026, 3, 20), type: "date" },
      {
        count: 2,
        postId: "post_1" as Id<"schoolClassForumPosts">,
        status: "history",
        type: "unread",
      },
      {
        isFirstInGroup: true,
        isLastInGroup: true,
        post: createPost("post_2"),
        showContinuationTime: false,
        type: "post",
      },
    ];
    conversationState.highlightedPostId =
      "post_2" as Id<"schoolClassForumPosts">;

    const container = render(<ForumConversationTranscript />);

    expect(
      container.querySelector('[data-testid="virtual-conversation"]')
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="virtua-virtualizer"]')
    ).not.toBeNull();
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
    expect(container.querySelector('[data-post-id="post_2"]')).not.toBeNull();
  });

  it("renders the loading placeholder before the first transcript window exists", () => {
    const container = render(<ForumConversationTranscriptPlaceholder />);

    expect(
      container.querySelector(
        '[data-testid="virtual-conversation-placeholder"]'
      )
    ).not.toBeNull();
  });

  it("settles one latest request even when the browser does not emit scroll events", () => {
    const post = createPost("post_latest");

    conversationState.items = [
      {
        isFirstInGroup: true,
        isLastInGroup: true,
        post,
        showContinuationTime: false,
        type: "post",
      },
    ];
    conversationState.isAtLatestEdge = true;
    conversationState.lastPostId = post._id;
    conversationState.scrollRequest = {
      id: 1,
      kind: "latest",
      smooth: false,
    } satisfies ConversationTranscriptCommand;

    render(<ForumConversationTranscript />);

    act(() => {
      flushAnimationFrames();
    });

    expect(conversationState.clearScrollRequest).toHaveBeenCalledWith(1);
    expect(conversationState.handleBottomStateChange).toHaveBeenCalledWith(
      true
    );
    expect(conversationState.handleSettledView).toHaveBeenCalledWith({
      kind: "bottom",
    });
  });
});
