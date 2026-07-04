import { describe, expect, it } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/data/entities";
import { createActiveTranscriptModel } from "@/components/school/classes/forum/conversation/data/transcript/active";
import {
  createConversationTestForum,
  createConversationTestPost,
} from "@/components/school/classes/forum/conversation/fixtures/data";

describe("conversation/data/transcript/active", () => {
  it("builds one indexed transcript model from the current loaded rows", () => {
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
    const third = createConversationTestPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      postId: "post_3",
      sequence: 3,
    });
    const model = createActiveTranscriptModel({
      forum: createConversationTestForum(),
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
    expect(model.rowIndexByPostId.get(first._id)).toBe(2);
    expect(model.rowIndexByPostId.get(second._id)).toBe(4);
    expect(model.rowIndexByPostId.get(third._id)).toBe(6);
  });

  it("keeps optimistic rows out of restorable transcript metadata", () => {
    const confirmed = createConversationTestPost({
      createdAt: Date.UTC(2026, 3, 20, 8, 0, 0),
      postId: "post_1",
      sequence: 1,
    });
    const optimistic = {
      ...createConversationTestPost({
        createdAt: Date.UTC(2026, 3, 20, 9, 0, 0),
        postId: "optimistic_post",
        sequence: 2,
      }),
      isOptimistic: true,
    } satisfies ForumPost;

    const model = createActiveTranscriptModel({
      forum: createConversationTestForum(),
      posts: [confirmed, optimistic],
      unreadCue: null,
    });

    expect(model.lastPostId).toBe(confirmed._id);
    expect(model.rowIndexByPostId.get(optimistic._id)).toBe(3);
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
    expect(model.rowIndexByPostId.size).toBe(0);
  });
});
