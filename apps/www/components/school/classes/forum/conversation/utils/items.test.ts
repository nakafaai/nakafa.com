import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import type { Forum } from "@/components/school/classes/forum/conversation/types";
import { buildVirtualItems } from "@/components/school/classes/forum/conversation/utils/items";

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

function createPost({
  id,
  createdBy,
  minute,
}: {
  id: string;
  createdBy: Id<"users">;
  minute: number;
}) {
  const createdTime = Date.UTC(2026, 3, 20, 10, minute, 0);

  return {
    _creationTime: createdTime,
    _id: id as Id<"schoolClassForumPosts">,
    attachments: [],
    body: id,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy,
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
    sequence: minute,
    updatedAt: createdTime,
    user: null,
  } satisfies ForumPost;
}

describe("conversation/utils/items", () => {
  it("builds header, unread, and grouped post rows in live mode", () => {
    const firstPost = createPost({
      id: "post_1",
      createdBy: userId,
      minute: 0,
    });
    const secondPost = createPost({
      id: "post_2",
      createdBy: userId,
      minute: 1,
    });
    const thirdPost = createPost({
      id: "post_3",
      createdBy: "user_2" as Id<"users">,
      minute: 2,
    });

    const result = buildVirtualItems({
      forum: createForum(),
      isDetachedMode: false,
      posts: [firstPost, secondPost, thirdPost],
      unreadCue: {
        count: 2,
        postId: secondPost._id,
        status: "new",
      },
    });

    expect(result.items.map((item) => item.type)).toEqual([
      "header",
      "post",
      "unread",
      "post",
      "post",
    ]);
    expect(result.postIdToIndex.get(firstPost._id)).toBe(1);
    expect(result.postIdToIndex.get(secondPost._id)).toBe(3);
    expect(result.postIdToIndex.get(thirdPost._id)).toBe(4);

    const firstRow = result.items[1];
    const secondRow = result.items[3];

    if (firstRow.type !== "post" || secondRow.type !== "post") {
      throw new Error("Expected post rows");
    }

    expect(firstRow.isFirstInGroup).toBe(true);
    expect(firstRow.isLastInGroup).toBe(false);
    expect(secondRow.showContinuationTime).toBe(true);
  });

  it("skips header and unread rows when the forum is missing or detached", () => {
    const post = createPost({
      id: "post_detached",
      createdBy: userId,
      minute: 0,
    });

    const result = buildVirtualItems({
      forum: undefined,
      isDetachedMode: true,
      posts: [post],
      unreadCue: {
        count: 1,
        postId: post._id,
        status: "history",
      },
    });

    expect(result.items.map((item) => item.type)).toEqual(["post"]);
    expect(result.postIdToIndex.get(post._id)).toBe(0);
  });

  it("inserts one date separator when the transcript crosses into a new day", () => {
    const firstDayPost = createPost({
      id: "post_day_1",
      createdBy: userId,
      minute: 0,
    });
    const nextDayPost = {
      ...createPost({
        id: "post_day_2",
        createdBy: userId,
        minute: 1,
      }),
      _creationTime: Date.UTC(2026, 3, 21, 10, 1, 0),
    };

    const result = buildVirtualItems({
      forum: undefined,
      isDetachedMode: false,
      posts: [firstDayPost, nextDayPost],
      unreadCue: null,
    });

    expect(result.items.map((item) => item.type)).toEqual([
      "post",
      "date",
      "post",
    ]);
    expect(result.postIdToIndex.get(nextDayPost._id)).toBe(2);
  });
});
