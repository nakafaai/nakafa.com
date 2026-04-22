import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";
import {
  createConversationRows,
  createFocusedTranscriptWindows,
  createLatestTranscriptWindow,
  createNewerTranscriptWindow,
  createOlderTranscriptWindow,
  flattenConversationPosts,
  getForumPostsWindowResult,
  getNewestWindowIndexKey,
  getOldestWindowIndexKey,
  getPostRowIndex,
} from "@/components/school/classes/forum/conversation/data/pages";

const forumId = "forum_1" as Id<"schoolClassForums">;

function createPost({
  createdAt,
  postId,
  sequence,
}: {
  createdAt: number;
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
    isUnread: false,
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

describe("conversation/data/pages", () => {
  it("flattens desc and asc windows into one ascending post list", () => {
    const newest = createPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 2, 0),
      postId: "post_3",
      sequence: 3,
    });
    const middle = createPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 1, 0),
      postId: "post_2",
      sequence: 2,
    });
    const oldest = createPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      postId: "post_1",
      sequence: 1,
    });
    const windows = [
      createFocusedTranscriptWindows(forumId, {
        indexKey: [forumId, 2, middle._creationTime, middle._id],
        postId: middle._id,
      })[0],
      createLatestTranscriptWindow(forumId),
    ];
    const results = {
      [windows[0].id]: {
        hasMore: false,
        indexKeys: [
          [forumId, 2, middle._creationTime, middle._id],
          [forumId, 1, oldest._creationTime, oldest._id],
        ],
        page: [middle, oldest],
      },
      [windows[1].id]: {
        hasMore: false,
        indexKeys: [[forumId, 3, newest._creationTime, newest._id]],
        page: [newest],
      },
    };

    expect(
      flattenConversationPosts(windows, results).map((post) => post.sequence)
    ).toEqual([1, 2, 3]);
  });

  it("builds header and date separators around the flattened posts", () => {
    const forum = {
      _creationTime: Date.UTC(2026, 3, 20, 7, 0, 0),
      _id: forumId,
      body: "body",
      classId: "class_1" as Id<"schoolClasses">,
      createdBy: "user_1" as Id<"users">,
      isPinned: false,
      lastPostAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      lastPostBy: "user_1" as Id<"users">,
      myReactions: [],
      nextPostSequence: 3,
      postCount: 2,
      reactionCounts: [],
      reactionUsers: [],
      schoolId: "school_1" as Id<"schools">,
      status: "open",
      tag: "general",
      title: "Forum",
      updatedAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      user: null,
    } satisfies Forum;
    const first = createPost({
      createdAt: Date.UTC(2026, 3, 20, 8, 0, 0),
      postId: "post_1",
      sequence: 1,
    });
    const second = createPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      postId: "post_2",
      sequence: 2,
    });
    const rows = createConversationRows({
      forum,
      posts: [first, second],
    });

    expect(rows.map((row) => row.type)).toEqual([
      "header",
      "date",
      "post",
      "date",
      "post",
    ]);
    expect(getPostRowIndex(rows, second._id)).toBe(4);
  });

  it("builds latest, older, and newer windows with pinned manual pagination keys", () => {
    const anchorKey = [forumId, 5, 123, "post_5"] as const;
    const latestWindow = createLatestTranscriptWindow(forumId);
    const olderWindow = createOlderTranscriptWindow(forumId, [...anchorKey]);
    const newerWindow = createNewerTranscriptWindow(forumId, [...anchorKey]);

    expect(latestWindow.args).toMatchObject({
      endIndexKey: [forumId, 0],
      forumId,
      numItems: 25,
      order: "desc",
      startIndexKey: [forumId, Number.MAX_SAFE_INTEGER],
    });
    expect(olderWindow.args).toMatchObject({
      forumId,
      order: "desc",
      startInclusive: false,
      startIndexKey: anchorKey,
    });
    expect(newerWindow.args).toMatchObject({
      endIndexKey: [forumId, Number.MAX_SAFE_INTEGER],
      forumId,
      order: "asc",
      startInclusive: false,
      startIndexKey: anchorKey,
    });
  });

  it("reads the visible oldest and newest keys from desc and asc windows", () => {
    const oldest = createPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 0, 0),
      postId: "post_1",
      sequence: 1,
    });
    const newest = createPost({
      createdAt: Date.UTC(2026, 3, 21, 8, 2, 0),
      postId: "post_3",
      sequence: 3,
    });
    const descWindow = createLatestTranscriptWindow(forumId);
    const ascWindow = createFocusedTranscriptWindows(forumId, {
      indexKey: [
        forumId,
        2,
        Date.UTC(2026, 3, 21, 8, 1, 0),
        "post_2" as Id<"schoolClassForumPosts">,
      ],
      postId: "post_2" as Id<"schoolClassForumPosts">,
    })[1];
    const descResult = {
      hasMore: true,
      indexKeys: [
        [forumId, newest.sequence, newest._creationTime, newest._id],
        [forumId, oldest.sequence, oldest._creationTime, oldest._id],
      ],
      page: [newest, oldest],
    };
    const ascResult = {
      hasMore: true,
      indexKeys: [
        [forumId, oldest.sequence, oldest._creationTime, oldest._id],
        [forumId, newest.sequence, newest._creationTime, newest._id],
      ],
      page: [oldest, newest],
    };

    expect(getOldestWindowIndexKey(descWindow, descResult)).toEqual(
      descResult.indexKeys[1]
    );
    expect(getNewestWindowIndexKey(descWindow, descResult)).toEqual(
      descResult.indexKeys[0]
    );
    expect(getOldestWindowIndexKey(ascWindow, ascResult)).toEqual(
      ascResult.indexKeys[0]
    );
    expect(getNewestWindowIndexKey(ascWindow, ascResult)).toEqual(
      ascResult.indexKeys[1]
    );
  });

  it("throws query failures instead of silently flattening them away", () => {
    const error = new Error("boom");

    expect(() => getForumPostsWindowResult(error)).toThrow("boom");
    expect(getForumPostsWindowResult(undefined)).toBeNull();
  });
});
