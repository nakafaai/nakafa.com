import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { createActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/active-transcript";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";

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

describe("conversation/data/active-transcript", () => {
  it("builds one indexed transcript model from the current loaded rows", () => {
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
    const third = createPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      postId: "post_3",
      sequence: 3,
    });
    const model = createActiveTranscriptModel({
      forum: createForum(),
      posts: [first, second, third],
      unreadCue: {
        count: 2,
        postId: second._id,
        status: "new",
      },
    });

    expect(model.rows.map((row) => row.type)).toEqual([
      "header",
      "date",
      "post",
      "unread",
      "post",
      "date",
      "post",
    ]);
    expect(model.postIds).toEqual([first._id, second._id, third._id]);
    expect(model.lastPostId).toBe(third._id);
    expect(model.lastRowIndex).toBe(6);
    expect(model.rowIndexByPostId.get(first._id)).toBe(2);
    expect(model.rowIndexByPostId.get(second._id)).toBe(4);
    expect(model.rowIndexByPostId.get(third._id)).toBe(6);
  });

  it("returns empty row metadata when the transcript has no loaded rows", () => {
    const model = createActiveTranscriptModel({
      forum: undefined,
      posts: [],
      unreadCue: null,
    });

    expect(model.rows).toEqual([]);
    expect(model.postIds).toEqual([]);
    expect(model.lastPostId).toBeNull();
    expect(model.lastRowIndex).toBeNull();
    expect(model.rowIndexByPostId.size).toBe(0);
  });
});
