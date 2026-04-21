import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import {
  appendUniquePosts,
  createLiveTimeline,
  createOlderPrefetchPages,
  getOlderPrefetchBoundaryPostId,
  prependUniquePosts,
  refreshFocusedTimeline,
  replaceMatchingPosts,
} from "@/components/school/classes/forum/conversation/utils/timeline";

const forumId = "forum_1" as Id<"schoolClassForums">;
const userId = "user_1" as Id<"users">;

function createPost(id: string, sequence: number): ForumPost {
  const createdTime = Date.UTC(2026, 3, 20, 10, sequence, 0);

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
    sequence,
    updatedAt: createdTime,
    user: null,
  } satisfies ForumPost;
}

describe("conversation/utils/timeline", () => {
  it("keeps one focused timeline frozen instead of appending live boundary growth", () => {
    const focusedTimeline = {
      hasMoreAfter: false,
      hasMoreBefore: true,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: "post_2" as Id<"schoolClassForumPosts">,
      oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
      posts: [createPost("post_1", 1), createPost("post_2", 2)],
    };
    const liveTimeline = createLiveTimeline(
      [
        createPost("post_1", 1),
        createPost("post_2", 2),
        createPost("post_3", 3),
      ],
      true
    );

    expect(
      refreshFocusedTimeline({
        current: focusedTimeline,
        livePosts: liveTimeline.posts,
      })
    ).toEqual(focusedTimeline);

    expect(
      refreshFocusedTimeline({
        current: focusedTimeline,
        livePosts: focusedTimeline.posts,
      })
    ).toBe(focusedTimeline);
  });

  it("creates live timelines with explicit null boundaries when no posts are loaded yet", () => {
    expect(createLiveTimeline([], false)).toEqual({
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId: null,
      oldestPostId: null,
      posts: [],
    });
  });

  it("derives older buffered pages in nearest-first commit order", () => {
    const fetchedPosts = [
      createPost("post_1", 1),
      createPost("post_2", 2),
      createPost("post_3", 3),
      createPost("post_4", 4),
      createPost("post_5", 5),
      createPost("post_6", 6),
    ];
    const renderedPosts = [createPost("post_5", 5), createPost("post_6", 6)];

    expect(
      createOlderPrefetchPages({
        fetchedPosts,
        hasMoreBefore: true,
        maxPages: 2,
        pageSize: 2,
        renderedPosts,
      })
    ).toEqual([
      {
        hasMoreBefore: true,
        oldestPostId: "post_3" as Id<"schoolClassForumPosts">,
        posts: [createPost("post_3", 3), createPost("post_4", 4)],
      },
      {
        hasMoreBefore: true,
        oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
        posts: [createPost("post_1", 1), createPost("post_2", 2)],
      },
    ]);
  });

  it("prefetches older focused pages from the oldest buffered page before the rendered boundary", () => {
    const renderedPosts = [createPost("post_5", 5), createPost("post_6", 6)];
    const bufferedPages = [
      {
        hasMoreBefore: true,
        oldestPostId: "post_3" as Id<"schoolClassForumPosts">,
        posts: [createPost("post_3", 3), createPost("post_4", 4)],
      },
      {
        hasMoreBefore: true,
        oldestPostId: "post_1" as Id<"schoolClassForumPosts">,
        posts: [createPost("post_1", 1), createPost("post_2", 2)],
      },
    ];

    expect(
      getOlderPrefetchBoundaryPostId({
        bufferedPages,
        renderedPosts,
      })
    ).toBe("post_1");

    expect(
      getOlderPrefetchBoundaryPostId({
        bufferedPages: [],
        renderedPosts,
      })
    ).toBe("post_5");

    expect(
      getOlderPrefetchBoundaryPostId({
        bufferedPages: [],
        renderedPosts: [],
      })
    ).toBeNull();
  });

  it("replaces matching posts and appends or prepends only unique ids", () => {
    const currentPosts = [createPost("post_1", 1), createPost("post_2", 2)];
    const refreshedPost = {
      ...createPost("post_2", 2),
      body: "post_2_updated",
    };

    expect(
      replaceMatchingPosts(currentPosts, [
        refreshedPost,
        createPost("post_9", 9),
      ])
    ).toEqual({
      changed: true,
      posts: [currentPosts[0], refreshedPost],
    });

    expect(prependUniquePosts(currentPosts, [createPost("post_0", 0)])).toEqual(
      {
        changed: true,
        posts: [createPost("post_0", 0), ...currentPosts],
      }
    );
    expect(prependUniquePosts(currentPosts, [currentPosts[0]])).toEqual({
      changed: false,
      posts: currentPosts,
    });

    expect(appendUniquePosts(currentPosts, [createPost("post_3", 3)])).toEqual({
      changed: true,
      posts: [...currentPosts, createPost("post_3", 3)],
    });

    expect(appendUniquePosts([], [])).toEqual({
      changed: false,
      posts: [],
    });
  });

  it("returns empty older prefetch pages when nothing older is buffered", () => {
    expect(
      createOlderPrefetchPages({
        fetchedPosts: [],
        hasMoreBefore: true,
        maxPages: 2,
        pageSize: 2,
        renderedPosts: [createPost("post_1", 1)],
      })
    ).toEqual([]);

    expect(
      createOlderPrefetchPages({
        fetchedPosts: [createPost("post_1", 1), createPost("post_2", 2)],
        hasMoreBefore: true,
        maxPages: 2,
        pageSize: 2,
        renderedPosts: [createPost("post_1", 1), createPost("post_2", 2)],
      })
    ).toEqual([]);
  });
});
