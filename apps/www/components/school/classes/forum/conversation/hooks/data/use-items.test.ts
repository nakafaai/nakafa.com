import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  buildVirtualItems,
  useItems,
} from "@/components/school/classes/forum/conversation/hooks/data/use-items";
import type { UnreadCue } from "@/components/school/classes/forum/conversation/hooks/data/use-unread";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/types";

const authorAId = "user_a" as Id<"users">;
const authorBId = "user_b" as Id<"users">;
const dayOne = Date.UTC(2026, 3, 20, 10, 0, 0);
const dayTwo = Date.UTC(2026, 3, 21, 10, 0, 0);

/** Narrows one hook result after the test harness has rendered it. */
function requireResult<T>(value: T): NonNullable<T> {
  if (!value) {
    throw new Error("Expected hook result to exist.");
  }

  return value as NonNullable<T>;
}

/** Creates one minimal forum post for virtual item grouping tests. */
function createPost({
  createdBy,
  createdTime,
  id,
}: {
  createdBy: Id<"users">;
  createdTime: number;
  id: string;
}) {
  return {
    _creationTime: createdTime,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy,
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
    updatedAt: createdTime,
    user: null,
  } satisfies ForumPost;
}

/** Creates one minimal forum row for hook wiring tests. */
function createForum(): Forum {
  return {
    _creationTime: dayOne,
    _id: "forum_1" as Id<"schoolClassForums">,
    body: "Forum body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: authorAId,
    isPinned: false,
    lastPostAt: dayOne,
    lastPostBy: authorAId,
    myReactions: [],
    nextPostSequence: 2,
    postCount: 1,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: "school_1" as Id<"schools">,
    status: "open",
    tag: "general",
    title: "Forum title",
    updatedAt: dayOne,
    user: null,
  } satisfies Forum;
}

describe("use-items grouping", () => {
  it("marks first and last posts within one same-author run", () => {
    const posts = [
      createPost({ createdBy: authorAId, createdTime: dayOne, id: "post_1" }),
      createPost({
        createdBy: authorAId,
        createdTime: dayOne + 10_000,
        id: "post_2",
      }),
      createPost({
        createdBy: authorAId,
        createdTime: dayOne + 70_000,
        id: "post_3",
      }),
    ];

    const items = buildVirtualItems({
      forum: undefined,
      isDetachedMode: false,
      posts,
      unreadCue: null,
    }).items.filter((item) => item.type === "post");

    expect(items).toEqual([
      expect.objectContaining({
        isFirstInGroup: true,
        isLastInGroup: false,
        showContinuationTime: false,
      }),
      expect.objectContaining({
        isFirstInGroup: false,
        isLastInGroup: false,
        showContinuationTime: false,
      }),
      expect.objectContaining({
        isFirstInGroup: false,
        isLastInGroup: true,
        showContinuationTime: true,
      }),
    ]);
  });

  it("splits groups when author or date changes", () => {
    const posts = [
      createPost({ createdBy: authorAId, createdTime: dayOne, id: "post_1" }),
      createPost({
        createdBy: authorBId,
        createdTime: dayOne + 60_000,
        id: "post_2",
      }),
      createPost({ createdBy: authorBId, createdTime: dayTwo, id: "post_3" }),
    ];

    const items = buildVirtualItems({
      forum: undefined,
      isDetachedMode: false,
      posts,
      unreadCue: null,
    }).items.filter((item) => item.type === "post");

    expect(items).toEqual([
      expect.objectContaining({
        isFirstInGroup: true,
        isLastInGroup: true,
        showContinuationTime: false,
      }),
      expect.objectContaining({
        isFirstInGroup: true,
        isLastInGroup: true,
        showContinuationTime: false,
      }),
      expect.objectContaining({
        isFirstInGroup: true,
        isLastInGroup: true,
        showContinuationTime: false,
      }),
    ]);
  });

  it("adds header, unread separator, and grouped posts through the hook wrapper", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const forum = createForum();
    const posts = [
      {
        ...createPost({
          createdBy: authorAId,
          createdTime: dayOne,
          id: "post_1",
        }),
        isUnread: true,
      },
      createPost({
        createdBy: authorAId,
        createdTime: dayOne + 60_000,
        id: "post_2",
      }),
    ];
    let result: ReturnType<typeof buildVirtualItems> | null = null;

    function TestComponent() {
      result = useItems({
        forum,
        isDetachedMode: false,
        posts,
        unreadCue: {
          count: 1,
          postId: posts[0]._id,
          status: "new",
        },
      });

      return null;
    }

    act(() => {
      root.render(createElement(TestComponent));
    });

    const hookResult: ReturnType<typeof buildVirtualItems> =
      requireResult(result);

    expect(hookResult.headerIndex).toBe(0);
    expect(hookResult.unreadIndex).toBe(1);
    expect(hookResult.items).toEqual([
      expect.objectContaining({ type: "header" }),
      expect.objectContaining({ type: "unread", count: 1, status: "new" }),
      expect.objectContaining({
        type: "post",
        isFirstInGroup: true,
        isLastInGroup: false,
        showContinuationTime: false,
      }),
      expect.objectContaining({
        type: "post",
        isFirstInGroup: false,
        isLastInGroup: true,
        showContinuationTime: true,
      }),
    ]);

    act(() => {
      root.unmount();
    });
  });

  it("skips unread separators while detached", () => {
    const posts = [
      createPost({ createdBy: authorAId, createdTime: dayOne, id: "post_1" }),
      {
        ...createPost({
          createdBy: authorAId,
          createdTime: dayOne + 60_000,
          id: "post_2",
        }),
        isUnread: true,
      },
    ];

    const items = buildVirtualItems({
      forum: undefined,
      isDetachedMode: true,
      posts,
      unreadCue: {
        count: 1,
        postId: posts[1]._id,
        status: "new",
      },
    }).items;

    expect(items).toEqual([
      expect.objectContaining({
        type: "post",
        isFirstInGroup: true,
        isLastInGroup: false,
        showContinuationTime: false,
      }),
      expect.objectContaining({
        type: "post",
        isFirstInGroup: false,
        isLastInGroup: true,
        showContinuationTime: true,
      }),
    ]);
  });

  it("keeps unread metadata empty when the hook is detached", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const posts = [
      {
        ...createPost({
          createdBy: authorAId,
          createdTime: dayOne,
          id: "post_1",
        }),
        isUnread: true,
      },
    ];
    let result: ReturnType<typeof buildVirtualItems> | null = null;

    function TestComponent() {
      result = useItems({
        forum: undefined,
        isDetachedMode: true,
        posts,
        unreadCue: {
          count: 1,
          postId: posts[0]._id,
          status: "new",
        },
      });

      return null;
    }

    act(() => {
      root.render(createElement(TestComponent));
    });

    const hookResult: ReturnType<typeof buildVirtualItems> =
      requireResult(result);

    expect(hookResult.unreadIndex).toBeNull();
    expect(hookResult.items).toEqual([
      expect.objectContaining({
        type: "post",
        isFirstInGroup: true,
        isLastInGroup: true,
        showContinuationTime: false,
      }),
    ]);

    act(() => {
      root.unmount();
    });
  });

  it("renders a historical unread cue without shifting its anchor post", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const posts = [
      createPost({ createdBy: authorAId, createdTime: dayOne, id: "post_1" }),
      createPost({
        createdBy: authorAId,
        createdTime: dayOne + 60_000,
        id: "post_2",
      }),
      createPost({
        createdBy: authorAId,
        createdTime: dayOne + 120_000,
        id: "post_3",
      }),
    ];
    let result: ReturnType<typeof useItems> | null = null;
    const unreadCue = {
      count: 2,
      postId: posts[0]._id,
      status: "history",
    } satisfies UnreadCue;

    function TestComponent() {
      result = useItems({
        forum: undefined,
        isDetachedMode: false,
        posts,
        unreadCue,
      });

      return null;
    }

    act(() => {
      root.render(createElement(TestComponent));
    });

    const hookResult: ReturnType<typeof buildVirtualItems> =
      requireResult(result);

    expect(hookResult.unreadIndex).toBe(0);
    expect(hookResult.items[0]).toEqual(
      expect.objectContaining({ type: "unread", count: 2, status: "history" })
    );

    act(() => {
      root.unmount();
    });
  });
});
