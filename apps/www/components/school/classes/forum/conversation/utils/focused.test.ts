import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";
import type { ForumPost } from "@/components/school/classes/forum/conversation/models";
import {
  createFocusedTimelineState,
  createFocusedWindowArgs,
  FORUM_CONVERSATION_WINDOW,
} from "@/components/school/classes/forum/conversation/utils/focused";

const forumId = "forum_1" as Id<"schoolClassForums">;
const oldestPostId = "post_oldest" as Id<"schoolClassForumPosts">;
const newestPostId = "post_newest" as Id<"schoolClassForumPosts">;

/** Creates one minimal focused query result for timeline projection tests. */
function createAroundResult(overrides?: {
  hasMoreAfter?: boolean;
  hasMoreBefore?: boolean;
  newestPostId?: Id<"schoolClassForumPosts"> | null;
  oldestPostId?: Id<"schoolClassForumPosts"> | null;
  posts?: ForumPost[];
}) {
  return {
    hasMoreAfter: overrides?.hasMoreAfter ?? false,
    hasMoreBefore: overrides?.hasMoreBefore ?? true,
    newestPostId: overrides?.newestPostId ?? newestPostId,
    oldestPostId: overrides?.oldestPostId ?? oldestPostId,
    posts: overrides?.posts ?? [],
  };
}

describe("forum focused window", () => {
  it("creates the shared around-query args for focused windows", () => {
    expect(
      createFocusedWindowArgs({
        forumId,
        targetPostId: newestPostId,
      })
    ).toEqual({
      forumId,
      limit: FORUM_CONVERSATION_WINDOW,
      targetPostId: newestPostId,
    });
  });

  it("creates a jump timeline that stays in jump mode away from the latest edge", () => {
    expect(
      createFocusedTimelineState({
        aroundResult: createAroundResult({ hasMoreAfter: true }),
        targetKind: "jump",
      })
    ).toEqual({
      hasMoreAfter: true,
      hasMoreBefore: true,
      isAtLatestEdge: false,
      isJumpMode: true,
      newestPostId,
      oldestPostId,
      posts: [],
    });
  });

  it("creates a restore timeline without jump mode even away from latest", () => {
    expect(
      createFocusedTimelineState({
        aroundResult: createAroundResult({ hasMoreAfter: true }),
        targetKind: "restore",
      })
    ).toEqual({
      hasMoreAfter: true,
      hasMoreBefore: true,
      isAtLatestEdge: false,
      isJumpMode: false,
      newestPostId,
      oldestPostId,
      posts: [],
    });
  });

  it("clears jump mode when the focused window already reaches the latest edge", () => {
    expect(
      createFocusedTimelineState({
        aroundResult: createAroundResult({
          hasMoreAfter: false,
          hasMoreBefore: false,
        }),
        targetKind: "jump",
      })
    ).toEqual({
      hasMoreAfter: false,
      hasMoreBefore: false,
      isAtLatestEdge: true,
      isJumpMode: false,
      newestPostId,
      oldestPostId,
      posts: [],
    });
  });
});
