import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useUnread } from "@/components/school/classes/forum/conversation/hooks/data/use-unread";
import type { ForumPost } from "@/components/school/classes/forum/conversation/types";

type UnreadHookResult = ReturnType<typeof useUnread>;

const authorAId = "user_a" as Id<"users">;
const dayOne = Date.UTC(2026, 3, 20, 10, 0, 0);

/** Narrows one hook result after the test harness has rendered it. */
function requireResult<T>(value: T): NonNullable<T> {
  if (!value) {
    throw new Error("Expected hook result to exist.");
  }

  return value as NonNullable<T>;
}

/** Creates one minimal forum post for unread-session tests. */
function createPost({
  id,
  isUnread = false,
}: {
  id: string;
  isUnread?: boolean;
}) {
  return {
    _creationTime: dayOne,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: authorAId,
    forumId: "forum_1" as Id<"schoolClassForums">,
    isUnread,
    mentions: [],
    myReactions: [],
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    replyToBody: undefined,
    replyToUser: null,
    replyToUserId: undefined,
    sequence: 1,
    updatedAt: dayOne,
    user: null,
  } satisfies ForumPost;
}

/** Renders the hook once and returns the latest hook snapshot. */
function renderUnreadHook({
  baselineLatestPostId,
  isDetachedMode,
  isInitialLoading,
  posts,
}: {
  baselineLatestPostId: Id<"schoolClassForumPosts"> | null;
  isDetachedMode: boolean;
  isInitialLoading: boolean;
  posts: ForumPost[];
}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let result: UnreadHookResult | null = null;

  function TestComponent() {
    result = useUnread({
      baselineLatestPostId,
      isDetachedMode,
      isInitialLoading,
      posts,
    });

    return null;
  }

  act(() => {
    root.render(createElement(TestComponent));
  });

  return {
    getResult: () => requireResult<UnreadHookResult | null>(result),
    root,
    container,
  };
}

describe("use-unread", () => {
  it("seeds one new unread cue once the first live transcript finishes loading", () => {
    const posts = [
      { ...createPost({ id: "post_1", isUnread: true }), sequence: 1 },
      { ...createPost({ id: "post_2", isUnread: true }), sequence: 2 },
      { ...createPost({ id: "post_3" }), sequence: 3 },
    ];
    const { container, getResult, root } = renderUnreadHook({
      baselineLatestPostId: posts[2]._id,
      isDetachedMode: false,
      isInitialLoading: false,
      posts,
    });

    expect(getResult().unreadCue).toEqual({
      count: 2,
      postId: posts[0]._id,
      status: "new",
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("freezes the seeded unread cue even after live unread flags disappear", () => {
    const unreadPosts = [
      { ...createPost({ id: "post_1", isUnread: true }), sequence: 1 },
      { ...createPost({ id: "post_2" }), sequence: 2 },
    ];
    const readPosts = [
      { ...createPost({ id: "post_1", isUnread: false }), sequence: 1 },
      { ...createPost({ id: "post_2" }), sequence: 2 },
    ];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let result: UnreadHookResult | null = null;

    function TestComponent({ posts }: { posts: ForumPost[] }) {
      result = useUnread({
        baselineLatestPostId: unreadPosts[1]._id,
        isDetachedMode: false,
        isInitialLoading: false,
        posts,
      });

      return null;
    }

    act(() => {
      root.render(createElement(TestComponent, { posts: unreadPosts }));
    });
    expect(requireResult<UnreadHookResult | null>(result).unreadCue).toEqual({
      count: 1,
      postId: unreadPosts[0]._id,
      status: "new",
    });

    act(() => {
      root.render(createElement(TestComponent, { posts: readPosts }));
    });
    expect(requireResult<UnreadHookResult | null>(result).unreadCue).toEqual({
      count: 1,
      postId: unreadPosts[0]._id,
      status: "new",
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("turns the cue into session history once the user reaches the live bottom", () => {
    const posts = [
      { ...createPost({ id: "post_1", isUnread: true }), sequence: 1 },
      { ...createPost({ id: "post_2" }), sequence: 2 },
    ];
    const { container, getResult, root } = renderUnreadHook({
      baselineLatestPostId: posts[1]._id,
      isDetachedMode: false,
      isInitialLoading: false,
      posts,
    });

    act(() => {
      getResult().acknowledgeUnreadCue();
    });

    expect(getResult().unreadCue).toEqual({
      count: 1,
      postId: posts[0]._id,
      status: "history",
    });

    act(() => {
      getResult().acknowledgeUnreadCue();
    });

    expect(getResult().unreadCue).toEqual({
      count: 1,
      postId: posts[0]._id,
      status: "history",
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not seed an unread cue while detached or still loading", () => {
    const posts = [
      { ...createPost({ id: "post_1", isUnread: true }), sequence: 1 },
    ];

    const detached = renderUnreadHook({
      baselineLatestPostId: null,
      isDetachedMode: true,
      isInitialLoading: false,
      posts,
    });
    expect(detached.getResult().unreadCue).toBeNull();
    act(() => {
      detached.getResult().acknowledgeUnreadCue();
    });
    expect(detached.getResult().unreadCue).toBeNull();
    act(() => {
      detached.root.unmount();
    });
    detached.container.remove();

    const loading = renderUnreadHook({
      baselineLatestPostId: null,
      isDetachedMode: false,
      isInitialLoading: true,
      posts,
    });
    expect(loading.getResult().unreadCue).toBeNull();
    act(() => {
      loading.root.unmount();
    });
    loading.container.remove();
  });
});
