import { describe, expect, it } from "vitest";
import {
  createConversationRows,
  getConversationRowKey,
  getLastConversationPostId,
} from "@/components/school/classes/forum/conversation/data/pages";
import {
  conversationTestForumId,
  createConversationTestForum,
  createConversationTestPost,
} from "@/components/school/classes/forum/conversation/helpers/test";

describe("conversation/data/pages", () => {
  it("builds header, date separators, and one unread separator in ascending order", () => {
    const first = createConversationTestPost({
      createdAt: Date.UTC(2026, 3, 20, 8, 0, 0),
      postId: "post_1",
      sequence: 1,
    });
    const second = createConversationTestPost({
      createdAt: Date.UTC(2026, 3, 20, 9, 0, 0),
      isUnread: true,
      postId: "post_2",
      sequence: 2,
    });
    const third = createConversationTestPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      isUnread: true,
      postId: "post_3",
      sequence: 3,
    });
    const rows = createConversationRows({
      forum: createConversationTestForum(),
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
    expect(getConversationRowKey(rows[0], conversationTestForumId)).toBe(
      conversationTestForumId
    );
    expect(getConversationRowKey(rows[1], conversationTestForumId)).toBe(
      `date:${first._creationTime}`
    );
    expect(getConversationRowKey(rows[3], conversationTestForumId)).toBe(
      `unread:${second._id}`
    );
    expect(getConversationRowKey(rows[6], conversationTestForumId)).toBe(
      third._id
    );
    expect(getLastConversationPostId([first, second, third])).toBe(third._id);
  });

  it("keeps the unread row anchored while switching from new to history", () => {
    const first = createConversationTestPost({
      createdAt: Date.UTC(2026, 3, 20, 8, 0, 0),
      postId: "post_1",
      sequence: 1,
    });
    const second = createConversationTestPost({
      createdAt: Date.UTC(2026, 3, 20, 9, 0, 0),
      postId: "post_2",
      sequence: 2,
    });

    const rows = createConversationRows({
      forum: createConversationTestForum(),
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
    expect(getConversationRowKey(rows[3], conversationTestForumId)).toBe(
      `unread:${second._id}`
    );
  });

  it("returns stable fallbacks for missing forum ids and empty post lists", () => {
    const rows = createConversationRows({
      forum: undefined,
      posts: [
        createConversationTestPost({
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
