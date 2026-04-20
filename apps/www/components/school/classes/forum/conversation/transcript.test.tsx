import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ForumConversationTranscript,
  ForumConversationTranscriptPlaceholder,
} from "@/components/school/classes/forum/conversation/transcript";
import type {
  Forum,
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";

const transcriptMock = vi.hoisted(() => ({
  value: {
    handleRef: { current: null },
    handleScroll: vi.fn(),
    handleScrollEnd: vi.fn(),
    highlightedPostId: null as Id<"schoolClassForumPosts"> | null,
    items: [] as VirtualItem[],
    scrollElementRef: { current: null as HTMLDivElement | null },
    setScrollElementRef: vi.fn(),
    shift: false,
  },
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

vi.mock(
  "@/components/school/classes/forum/conversation/hooks/transcript/use-transcript",
  () => ({
    useTranscript: () => transcriptMock.value,
  })
);

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

/** Creates one minimal forum thread for transcript row tests. */
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

/** Creates one minimal post row payload for transcript rendering tests. */
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

/** Mounts one React element into a detached test container. */
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

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.();
  }
});

describe("conversation/transcript", () => {
  it("renders the Virtua transcript shell and semantic rows", () => {
    transcriptMock.value = {
      ...transcriptMock.value,
      highlightedPostId: "post_2" as Id<"schoolClassForumPosts">,
      items: [
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
      ],
    };

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
});
