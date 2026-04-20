import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useController } from "@/components/school/classes/forum/conversation/hooks/use-controller";
import type {
  Forum,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import type { ForumConversationView, ForumPost } from "@/lib/store/forum";

const mocks = vi.hoisted(() => ({
  acknowledgeUnreadCue: vi.fn(),
  cancelPendingMarkRead: vi.fn(),
  clearJumpHighlightTimeout: vi.fn(),
  convexQuery: vi.fn(),
  flushMarkRead: vi.fn(),
  loadNewerPosts: vi.fn(),
  loadOlderPosts: vi.fn(),
  markPendingBottomPersistence: vi.fn(),
  replaceWithFocusedTimeline: vi.fn(),
  resetPendingBottomPersistence: vi.fn(),
  resetScrollState: vi.fn(),
  saveConversationView: vi.fn(),
  scheduleMarkRead: vi.fn(),
  scrollToBottom: vi.fn(() => false),
  scrollToPost: vi.fn(() => false),
  showLatestPosts: vi.fn(),
  startJumpHighlightTimeout: vi.fn(),
  state: {
    currentView: null as ForumConversationView | null,
    items: [] as VirtualItem[],
    postIdToIndex: new Map<Id<"schoolClassForumPosts">, number>(),
    posts: [] as ForumPost[],
  },
}));

vi.mock("@mantine/hooks", () => ({
  useReducedMotion: () => false,
  useTimeout: () => ({
    clear: mocks.clearJumpHighlightTimeout,
    start: mocks.startJumpHighlightTimeout,
  }),
}));

vi.mock("convex/react", () => ({
  useConvex: () => ({
    query: mocks.convexQuery,
  }),
}));

vi.mock(
  "@/components/school/classes/forum/conversation/hooks/use-items",
  () => ({
    useItems: () => ({
      items: mocks.state.items,
      postIdToIndex: mocks.state.postIdToIndex,
    }),
  })
);

vi.mock(
  "@/components/school/classes/forum/conversation/hooks/use-posts",
  () => ({
    usePosts: () => ({
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: true,
      isInitialLoading: false,
      isLoadingNewer: false,
      isLoadingOlder: false,
      loadNewerPosts: mocks.loadNewerPosts,
      loadOlderPosts: mocks.loadOlderPosts,
      posts: mocks.state.posts,
      replaceWithFocusedTimeline: mocks.replaceWithFocusedTimeline,
      showLatestPosts: mocks.showLatestPosts,
      timelineSessionVersion: 0,
    }),
  })
);

vi.mock(
  "@/components/school/classes/forum/conversation/hooks/use-read",
  () => ({
    useRead: () => ({
      cancelPendingMarkRead: mocks.cancelPendingMarkRead,
      flushMarkRead: mocks.flushMarkRead,
      scheduleMarkRead: mocks.scheduleMarkRead,
    }),
  })
);

vi.mock(
  "@/components/school/classes/forum/conversation/hooks/use-scroll",
  () => ({
    useScroll: () => ({
      captureCurrentConversationView: () => mocks.state.currentView,
      containerRef: { current: null },
      handleInitialAnchorSettled: vi.fn(),
      handleScroll: vi.fn(),
      initialAnchor: null,
      isAtBottom: false,
      isPostVisible: vi.fn(() => false),
      markPendingBottomPersistence: mocks.markPendingBottomPersistence,
      resetPendingBottomPersistence: mocks.resetPendingBottomPersistence,
      resetScrollState: mocks.resetScrollState,
      scrollToBottom: mocks.scrollToBottom,
      scrollToPost: mocks.scrollToPost,
    }),
  })
);

vi.mock(
  "@/components/school/classes/forum/conversation/hooks/use-unread",
  () => ({
    useUnread: () => ({
      acknowledgeUnreadCue: mocks.acknowledgeUnreadCue,
      unreadCue: null,
    }),
  })
);

vi.mock("@/lib/context/use-forum", () => ({
  useForum: (
    selector: (state: {
      saveConversationView: typeof mocks.saveConversationView;
    }) => unknown
  ) =>
    selector({
      saveConversationView: mocks.saveConversationView,
    }),
  useForumStoreApi: () => ({
    getState: () => ({
      savedConversationViews: {},
    }),
  }),
}));

const forumId = "forum_1" as Id<"schoolClassForums">;
const authorId = "user_1" as Id<"users">;
const firstPostId = "post_1" as Id<"schoolClassForumPosts">;
const secondPostId = "post_2" as Id<"schoolClassForumPosts">;
const createdTime = Date.UTC(2026, 3, 20, 12, 0, 0);

/** Creates one minimal forum row for controller hook tests. */
function createForum(): Forum {
  return {
    _creationTime: createdTime,
    _id: forumId,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: authorId,
    isPinned: false,
    lastPostAt: createdTime,
    lastPostBy: authorId,
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

/** Creates one minimal post row for virtual transcript tests. */
function createPost(postId: Id<"schoolClassForumPosts">): ForumPost {
  return {
    _creationTime: createdTime,
    _id: postId,
    attachments: [],
    body: String(postId),
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: authorId,
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

/** Creates one virtual post item that matches the hook's mounted transcript model. */
function createPostItem(post: ForumPost): VirtualItem {
  return {
    isFirstInGroup: true,
    isLastInGroup: true,
    post,
    showContinuationTime: false,
    type: "post",
  };
}

/** Mounts the controller hook so lifecycle-only regressions can be asserted. */
function renderUseController() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const forum = createForum();

  function TestComponent({ revision }: { revision: number }) {
    useController({ forum, forumId });
    return createElement("div", {
      "data-revision": revision,
    });
  }

  const render = (revision: number) => {
    act(() => {
      root.render(createElement(TestComponent, { revision }));
    });
  };

  render(0);

  return {
    rerender: (revision: number) => {
      render(revision);
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("use-controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const firstPost = createPost(firstPostId);

    mocks.state.currentView = {
      kind: "post",
      offset: 24,
      postId: firstPostId,
    };
    mocks.state.items = [createPostItem(firstPost)];
    mocks.state.postIdToIndex = new Map([[firstPostId, 0]]);
    mocks.state.posts = [firstPost];
  });

  it("keeps unmount cleanup dormant while transcript items rerender", () => {
    const rendered = renderUseController();
    const secondPost = createPost(secondPostId);

    mocks.state.currentView = {
      kind: "post",
      offset: 12,
      postId: secondPostId,
    };
    mocks.state.items = [
      createPostItem(createPost(firstPostId)),
      createPostItem(secondPost),
    ];
    mocks.state.postIdToIndex = new Map([
      [firstPostId, 0],
      [secondPostId, 1],
    ]);
    mocks.state.posts = [createPost(firstPostId), secondPost];

    rendered.rerender(1);

    expect(mocks.saveConversationView).not.toHaveBeenCalled();
    expect(mocks.resetScrollState).not.toHaveBeenCalled();

    rendered.unmount();

    expect(mocks.saveConversationView).toHaveBeenCalledTimes(1);
    expect(mocks.saveConversationView).toHaveBeenCalledWith(forumId, {
      kind: "post",
      offset: 12,
      postId: secondPostId,
    });
    expect(mocks.resetScrollState).toHaveBeenCalledTimes(1);
  });
});
