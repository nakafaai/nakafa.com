import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ForumConversationView,
  ForumPost,
} from "@/components/school/classes/forum/conversation/models";
import {
  ConversationProvider,
  useConversation,
} from "@/components/school/classes/forum/conversation/provider";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import { FORUM_CONVERSATION_WINDOW } from "@/components/school/classes/forum/conversation/utils/focused";

const forumStoreMock = vi.hoisted(() => ({
  isHydrated: true,
  saveConversationView: vi.fn(),
  savedConversationViews: {} as Record<string, unknown>,
}));

const convexQueryMock = vi.hoisted(() => vi.fn());
const paginatedQueryState = vi.hoisted(() => ({
  loadMore: vi.fn(),
  results: [] as ForumPost[],
  status: "Exhausted" as "CanLoadMore" | "Exhausted" | "LoadingMore",
}));

vi.mock("convex/react", () => ({
  useConvex: () => ({
    query: convexQueryMock,
  }),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({
    loadMore: paginatedQueryState.loadMore,
    results: paginatedQueryState.results,
    status: paginatedQueryState.status,
  }),
}));

vi.mock(
  "@/components/school/classes/forum/conversation/context/use-forum",
  () => ({
    useForum: (selector: (state: typeof forumStoreMock) => unknown) =>
      selector(forumStoreMock),
  })
);

const mountedRoots: Array<() => void> = [];
const currentUserId = "user_1" as Id<"users">;
const forumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one minimal forum payload for provider tests. */
function createForum(): Forum {
  const createdTime = Date.UTC(2026, 3, 21, 10, 0, 0);

  return {
    _creationTime: createdTime,
    _id: forumId,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: currentUserId,
    isPinned: false,
    lastPostAt: createdTime,
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
    updatedAt: createdTime,
    user: null,
  } satisfies Forum;
}

/** Creates one minimal forum post payload for provider runtime wiring tests. */
function createPost(id: string, sequence: number): ForumPost {
  const createdTime = Date.UTC(2026, 3, 21, 10, sequence, 0);

  return {
    _creationTime: createdTime,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: currentUserId,
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
    sequence,
    updatedAt: createdTime,
    user: null,
  } satisfies ForumPost;
}

/** Mounts the provider once and returns the detached container for assertions. */
function renderWithProvider(children: ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);

  document.body.append(container);

  act(() => {
    root.render(
      <ConversationProvider
        currentUserId={currentUserId}
        forum={createForum()}
        forumId={forumId}
      >
        {children}
      </ConversationProvider>
    );
  });

  mountedRoots.push(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  return container;
}

/** Flushes one async provider action chain into the next committed render. */
async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

afterEach(() => {
  while (mountedRoots.length > 0) {
    mountedRoots.pop()?.();
  }
});

describe("conversation/provider", () => {
  beforeEach(() => {
    forumStoreMock.saveConversationView.mockClear();
    forumStoreMock.savedConversationViews = {};
    convexQueryMock.mockReset();
    paginatedQueryState.loadMore.mockReset();
    paginatedQueryState.results = [];
    paginatedQueryState.status = "Exhausted";
  });

  it("exposes selected runtime store state from the active provider", () => {
    let selectedForumId = "" as Id<"schoolClassForums">;
    let selectedBottomState = true;

    /** Reads two representative runtime slices from the provider store. */
    function Probe() {
      selectedForumId = useConversation((state) => state.forumId);
      selectedBottomState = useConversation((state) => state.isAtBottom);
      return null;
    }

    renderWithProvider(<Probe />);

    expect(selectedForumId).toBe(forumId);
    expect(selectedBottomState).toBe(false);
  });

  it("throws when one consumer reads conversation state outside the provider", () => {
    function Probe() {
      useConversation((state) => state.forumId);
      return null;
    }

    expect(() => {
      const container = document.createElement("div");
      const root = createRoot(container);

      act(() => {
        root.render(<Probe />);
      });
    }).toThrow("useConversation must be used within a ConversationProvider");
  });

  it("persists settled views back into the feature-local forum store", () => {
    let handleSettledView: ((view: ForumConversationView) => void) | null =
      null;

    function Probe() {
      handleSettledView = useConversation((state) => state.handleSettledView);
      return null;
    }

    renderWithProvider(<Probe />);

    act(() => {
      handleSettledView?.({ kind: "bottom" });
    });

    expect(forumStoreMock.saveConversationView).toHaveBeenCalledWith(forumId, {
      kind: "bottom",
    });
  });

  it("wires live older paging through the provider dependency boundary", () => {
    let loadOlderPosts: (() => boolean) | null = null;

    paginatedQueryState.results = [
      createPost("post_1", 1),
      createPost("post_2", 2),
    ];
    paginatedQueryState.status = "CanLoadMore";

    function Probe() {
      loadOlderPosts = useConversation((state) => state.loadOlderPosts);
      return null;
    }

    renderWithProvider(<Probe />);

    let didLoadOlder = false;

    act(() => {
      didLoadOlder = loadOlderPosts?.() ?? false;
    });

    expect(didLoadOlder).toBe(true);
    expect(paginatedQueryState.loadMore).toHaveBeenCalledWith(
      FORUM_CONVERSATION_WINDOW
    );
  });

  it("does not call loadMore when the live query cannot page older posts", () => {
    let loadOlderPosts: (() => boolean) | null = null;
    let syncLiveWindow:
      | ((payload: { hasMoreBefore: boolean; posts: ForumPost[] }) => void)
      | null = null;

    paginatedQueryState.results = [createPost("post_1", 1)];
    paginatedQueryState.status = "Exhausted";

    function Probe() {
      loadOlderPosts = useConversation((state) => state.loadOlderPosts);
      syncLiveWindow = useConversation((state) => state.syncLiveWindow);
      return null;
    }

    renderWithProvider(<Probe />);

    act(() => {
      syncLiveWindow?.({
        hasMoreBefore: true,
        posts: [createPost("post_1", 1)],
      });
      loadOlderPosts?.();
    });

    expect(paginatedQueryState.loadMore).not.toHaveBeenCalled();
  });

  it("routes focused paging requests through the convex query client", async () => {
    let jumpToPostId: ((postId: Id<"schoolClassForumPosts">) => void) | null =
      null;
    let loadNewerPosts: (() => boolean) | null = null;
    let loadOlderPosts: (() => boolean) | null = null;

    paginatedQueryState.results = [createPost("post_live", 10)];
    convexQueryMock.mockImplementation(
      (_query, args: Record<string, unknown>) => {
        if ("targetPostId" in args) {
          return Promise.resolve({
            hasMoreAfter: true,
            hasMoreBefore: true,
            newestPostId: "post_focus" as Id<"schoolClassForumPosts">,
            oldestPostId: "post_focus" as Id<"schoolClassForumPosts">,
            posts: [createPost("post_focus", 20)],
          });
        }

        if ("afterPostId" in args) {
          return Promise.resolve({
            hasMore: false,
            newestPostId: "post_newer" as Id<"schoolClassForumPosts">,
            posts: [createPost("post_newer", 21)],
          });
        }

        return Promise.resolve({
          hasMore: false,
          oldestPostId: "post_older" as Id<"schoolClassForumPosts">,
          posts: [createPost("post_older", 19)],
        });
      }
    );

    function Probe() {
      jumpToPostId = useConversation((state) => state.jumpToPostId);
      loadNewerPosts = useConversation((state) => state.loadNewerPosts);
      loadOlderPosts = useConversation((state) => state.loadOlderPosts);
      return null;
    }

    renderWithProvider(<Probe />);

    act(() => {
      jumpToPostId?.("post_focus" as Id<"schoolClassForumPosts">);
    });
    await flushAsyncWork();

    act(() => {
      loadNewerPosts?.();
      loadOlderPosts?.();
    });
    await flushAsyncWork();

    expect(convexQueryMock).toHaveBeenCalledTimes(3);
    expect(convexQueryMock.mock.calls[0]?.[1]).toMatchObject({
      forumId,
      limit: FORUM_CONVERSATION_WINDOW,
      targetPostId: "post_focus",
    });
    expect(convexQueryMock.mock.calls[1]?.[1]).toMatchObject({
      afterPostId: "post_focus",
      forumId,
      limit: FORUM_CONVERSATION_WINDOW,
    });
    expect(convexQueryMock.mock.calls[2]?.[1]).toMatchObject({
      beforePostId: "post_focus",
      forumId,
      limit: FORUM_CONVERSATION_WINDOW,
    });
  });
});
