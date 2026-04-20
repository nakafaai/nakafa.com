import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it, vi } from "vitest";
import type {
  Forum,
  ForumPost,
  VirtualItem,
} from "@/components/school/classes/forum/conversation/types";
import {
  getConversationItemKey,
  measureConversationItemSize,
} from "@/components/school/classes/forum/conversation/utils/transcript";

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

describe("conversation/utils/transcript", () => {
  it("keeps one post key stable when the transcript prepends older items", () => {
    const postItem = {
      isFirstInGroup: true,
      isLastInGroup: true,
      post: createPost("post_2"),
      showContinuationTime: false,
      type: "post",
    } satisfies VirtualItem;

    expect(getConversationItemKey(postItem)).toBe("post:post_2");
    expect(getConversationItemKey(postItem)).toBe("post:post_2");
  });

  it("keeps semantic keys stable for non-post transcript rows", () => {
    const forumItem = {
      forum: createForum(),
      type: "header",
    } satisfies VirtualItem;
    const unreadItem = {
      count: 3,
      postId: "post_2" as Id<"schoolClassForumPosts">,
      status: "history",
      type: "unread",
    } satisfies VirtualItem;
    const dateItem = {
      date: Date.UTC(2026, 3, 20),
      type: "date",
    } satisfies VirtualItem;

    expect(getConversationItemKey(forumItem)).toBe("header");
    expect(getConversationItemKey(unreadItem)).toBe("unread:post_2");
    expect(getConversationItemKey(dateItem)).toBe(
      `date:${Date.UTC(2026, 3, 20)}`
    );
  });

  it("keeps fractional precision from ResizeObserver measurements", () => {
    const element = document.createElement("div");
    const resizeEntry: ResizeObserverEntry = {
      borderBoxSize: [{ blockSize: 88.5, inlineSize: 0 }],
      contentBoxSize: [{ blockSize: 88.5, inlineSize: 0 }],
      contentRect: new DOMRectReadOnly(0, 0, 0, 88.5),
      devicePixelContentBoxSize: [{ blockSize: 88.5, inlineSize: 0 }],
      target: element,
    };

    expect(measureConversationItemSize(element, resizeEntry)).toBe(88.5);
  });

  it("falls back to getBoundingClientRect when ResizeObserver data is absent", () => {
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      bottom: 42.25,
      height: 42.25,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => "",
    });

    expect(measureConversationItemSize(element, undefined)).toBe(42.25);
  });
});
