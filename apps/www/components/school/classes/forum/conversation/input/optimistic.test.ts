import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import {
  createConversationTestForum,
  createConversationTestPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";
import {
  createOptimisticForumPost,
  getOptimisticForumPostSequence,
} from "./optimistic";

const optimisticPostId = "optimistic_post" as Id<"schoolClassForumPosts">;
const currentUser = {
  _id: "user_current" as Id<"users">,
  email: "nabil@example.test",
  image: "https://example.test/nabil.png",
  name: "Nabil Fatih",
};

describe("conversation/input/optimistic", () => {
  it("derives the next sequence from the loaded transcript window", () => {
    const forum = createConversationTestForum();
    const posts = [
      createConversationTestPost({ postId: "post_1", sequence: 7 }),
      createConversationTestPost({ postId: "post_2", sequence: 8 }),
    ];

    expect(getOptimisticForumPostSequence({ forum, posts })).toBe(9);
  });

  it("uses zero as the loaded sequence when the transcript is empty", () => {
    const forum = {
      ...createConversationTestForum(),
      nextPostSequence: 1,
    };

    expect(getOptimisticForumPostSequence({ forum, posts: [] })).toBe(1);
  });

  it("keeps the forum next sequence when the loaded window is stale", () => {
    const forum = {
      ...createConversationTestForum(),
      nextPostSequence: 20,
    };
    const posts = [
      createConversationTestPost({ postId: "post_1", sequence: 7 }),
      createConversationTestPost({ postId: "post_2", sequence: 8 }),
    ];

    expect(getOptimisticForumPostSequence({ forum, posts })).toBe(20);
  });

  it("creates a transcript-compatible optimistic post row", () => {
    const forum = createConversationTestForum();
    const parentPost = createConversationTestPost({
      postId: "post_parent",
      sequence: 8,
    });
    const posts = [parentPost];
    const post = createOptimisticForumPost({
      args: {
        body: "reply sekarang",
        forumId: forum._id,
        parentId: parentPost._id,
      },
      currentUser,
      forum,
      now: Date.UTC(2026, 6, 3, 12, 0, 0),
      parentPost,
      postId: optimisticPostId,
      posts,
    });

    expect(post).toMatchObject({
      _id: optimisticPostId,
      attachments: [],
      body: "reply sekarang",
      classId: forum.classId,
      createdBy: currentUser._id,
      forumId: forum._id,
      isUnread: false,
      myReactions: [],
      parentId: parentPost._id,
      replyToBody: parentPost.body,
      replyToUser: parentPost.user,
      replyToUserId: parentPost.createdBy,
      sequence: 9,
      user: currentUser,
    });
  });
});
