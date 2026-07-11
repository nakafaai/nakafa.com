import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import { markTranscriptRead } from "@/components/school/classes/forum/read/state";

const postId = (value: string) => value as Id<"schoolClassForumPosts">;

const posts = [
  { _id: postId("post-1"), isUnread: false, sequence: 1 },
  { _id: postId("post-2"), isUnread: true, sequence: 2 },
  { _id: postId("post-3"), isUnread: true, sequence: 3 },
];

describe("markTranscriptRead", () => {
  it("marks unread posts through the selected boundary", () => {
    const state = markTranscriptRead(posts, postId("post-2"));

    expect(state).toEqual({
      posts: [
        { _id: postId("post-1"), isUnread: false, sequence: 1 },
        { _id: postId("post-2"), isUnread: false, sequence: 2 },
        { _id: postId("post-3"), isUnread: true, sequence: 3 },
      ],
      unreadCount: 1,
    });
  });

  it("clears the count when the latest post is the boundary", () => {
    expect(markTranscriptRead(posts, postId("post-3"))?.unreadCount).toBe(0);
  });

  it("does not change cache state for an unloaded boundary", () => {
    expect(markTranscriptRead(posts, postId("missing"))).toBeNull();
  });
});
