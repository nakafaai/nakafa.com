import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import {
  createConversationRows,
  getConversationRowKey,
  getLastConversationPostId,
} from "@/components/school/classes/forum/conversation/data/pages";

const forumId = "forum_1" as Id<"schoolClassForums">;

function createPost({
  createdAt,
  isUnread = false,
  postId,
  sequence,
}: {
  createdAt: number;
  isUnread?: boolean;
  postId: string;
  sequence: number;
}) {
  return {
    _creationTime: createdAt,
    _id: postId as Id<"schoolClassForumPosts">,
    attachments: [],
    body: `post-${sequence}`,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: "user_1" as Id<"users">,
    forumId,
    isUnread,
    mentions: [],
    myReactions: [],
    reactionCounts: [],
    reactionUsers: [],
    replyCount: 0,
    replyToBody: undefined,
    replyToUser: null,
    replyToUserId: undefined,
    sequence,
    updatedAt: createdAt,
    user: null,
  } satisfies ForumPost;
}

function createForum() {
  return {
    _creationTime: Date.UTC(2026, 3, 20, 7, 0, 0),
    _id: forumId,
    body: "body",
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: "user_1" as Id<"users">,
    isPinned: false,
    lastPostAt: Date.UTC(2026, 3, 21, 8, 0, 0),
    lastPostBy: "user_1" as Id<"users">,
    myReactions: [],
    nextPostSequence: 4,
    postCount: 3,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: "school_1" as Id<"schools">,
    status: "open",
    tag: "general",
    title: "Forum",
    updatedAt: Date.UTC(2026, 3, 21, 8, 0, 0),
    user: null,
  } satisfies Forum;
}

describe("conversation/data/pages", () => {
  it("builds header, date separators, and one unread separator in ascending order", () => {
    const first = createPost({
      createdAt: Date.UTC(2026, 3, 20, 8, 0, 0),
      postId: "post_1",
      sequence: 1,
    });
    const second = createPost({
      createdAt: Date.UTC(2026, 3, 20, 9, 0, 0),
      isUnread: true,
      postId: "post_2",
      sequence: 2,
    });
    const third = createPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      isUnread: true,
      postId: "post_3",
      sequence: 3,
    });
    const rows = createConversationRows({
      forum: createForum(),
      posts: [first, second, third],
      unreadCue: {
        count: 2,
        postId: second._id,
        status: "new",
      },
    });

    expect(rows.map((row) => row.type)).toEqual([
      "header",
      "date",
      "post",
      "unread",
      "post",
      "date",
      "post",
    ]);
    expect(getConversationRowKey(rows[0], forumId)).toBe(forumId);
    expect(getConversationRowKey(rows[1], forumId)).toBe(
      `date:${first._creationTime}`
    );
    expect(getConversationRowKey(rows[3], forumId)).toBe(
      `unread:${second._id}`
    );
    expect(getConversationRowKey(rows[6], forumId)).toBe(third._id);
    expect(getLastConversationPostId([first, second, third])).toBe(third._id);
  });

  it("keeps the unread row anchored while switching from new to history", () => {
    const first = createPost({
      createdAt: Date.UTC(2026, 3, 20, 8, 0, 0),
      postId: "post_1",
      sequence: 1,
    });
    const second = createPost({
      createdAt: Date.UTC(2026, 3, 20, 9, 0, 0),
      postId: "post_2",
      sequence: 2,
    });

    const rows = createConversationRows({
      forum: createForum(),
      posts: [first, second],
      unreadCue: {
        count: 2,
        postId: second._id,
        status: "history",
      },
    });

    expect(rows[3]).toMatchObject({
      count: 2,
      postId: second._id,
      status: "history",
      type: "unread",
    });
    expect(getConversationRowKey(rows[3], forumId)).toBe(
      `unread:${second._id}`
    );
  });

  it("returns stable fallbacks for missing forum ids and empty post lists", () => {
    const rows = createConversationRows({
      forum: undefined,
      posts: [
        createPost({
          createdAt: Date.UTC(2026, 3, 20, 8, 0, 0),
          postId: "post_1",
          sequence: 1,
        }),
      ],
    });

    expect(rows.map((row) => row.type)).toEqual(["date", "post"]);
    expect(getConversationRowKey({ type: "header" }, undefined)).toBe("header");
    expect(getLastConversationPostId([])).toBeNull();
  });
});
