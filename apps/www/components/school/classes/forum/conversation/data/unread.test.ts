import { describe, expect, it } from "vitest";
import { getInitialConversationUnreadCue } from "@/components/school/classes/forum/conversation/data/unread";
import { createConversationTestPost } from "@/components/school/classes/forum/conversation/helpers/test";

describe("conversation/data/unread", () => {
  it("returns the first unread post id and total unread count", () => {
    const cue = getInitialConversationUnreadCue([
      createConversationTestPost({ postId: "post_1", sequence: 1 }),
      createConversationTestPost({
        isUnread: true,
        postId: "post_2",
        sequence: 2,
      }),
      createConversationTestPost({
        isUnread: true,
        postId: "post_3",
        sequence: 3,
      }),
    ]);

    expect(cue).toEqual({
      count: 2,
      postId: "post_2",
    });
  });

  it("returns null when the transcript has no unread posts", () => {
    const cue = getInitialConversationUnreadCue([
      createConversationTestPost({ postId: "post_1", sequence: 1 }),
      createConversationTestPost({ postId: "post_2", sequence: 2 }),
    ]);

    expect(cue).toBeNull();
  });
});
