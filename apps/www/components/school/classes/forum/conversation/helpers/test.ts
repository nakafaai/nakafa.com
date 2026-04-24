import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { vi } from "vitest";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";

export const conversationTestForumId = "forum_1" as Id<"schoolClassForums">;

/** Creates one readable forum-post fixture for conversation tests. */
export function createConversationTestPost({
  createdAt,
  isUnread = false,
  postId,
  sequence,
}: {
  createdAt?: number;
  isUnread?: boolean;
  postId: string;
  sequence: number;
}) {
  const resolvedCreatedAt = createdAt ?? Date.UTC(2026, 3, 20, 8, sequence, 0);

  return {
    _creationTime: resolvedCreatedAt,
    _id: postId as Id<"schoolClassForumPosts">,
    attachments: [],
    body: `post-${sequence}`,
    classId: "class_1" as Id<"schoolClasses">,
    createdBy: "user_1" as Id<"users">,
    forumId: conversationTestForumId,
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
    updatedAt: resolvedCreatedAt,
    user: null,
  } satisfies ForumPost;
}

/** Creates one forum fixture aligned with the transcript test data. */
export function createConversationTestForum() {
  return {
    _creationTime: Date.UTC(2026, 3, 20, 7, 0, 0),
    _id: conversationTestForumId,
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

/** Creates one configurable `virtua` handle fixture for transcript tests. */
export function createConversationTestHandle({
  findItemIndex = (offset: number) => Math.min(9, Math.floor(offset / 100)),
  getItemOffset = (index: number) => index * 100,
  getItemSize = () => 100,
  scrollOffset,
  scrollSize = 3000,
  viewportSize = 400,
}: {
  findItemIndex?: (offset: number) => number;
  getItemOffset?: (index: number) => number;
  getItemSize?: (index: number) => number;
  scrollOffset: number;
  scrollSize?: number;
  viewportSize?: number;
}) {
  const scrollBy = vi.fn();
  const scrollTo = vi.fn();
  const scrollToIndex = vi.fn();

  return {
    handle: {
      cache: {},
      findItemIndex,
      getItemOffset,
      getItemSize,
      scrollBy,
      scrollOffset,
      scrollSize,
      scrollTo,
      scrollToIndex,
      viewportSize,
    },
    scrollBy,
    scrollTo,
    scrollToIndex,
  };
}

/** Creates one deterministic `findItemIndex` callback from item start offsets. */
export function createConversationTestFindItemIndex(
  offsets: readonly number[]
) {
  return (offset: number) => {
    let lastMatchingIndex = 0;

    for (const [index, itemOffset] of offsets.entries()) {
      if (itemOffset > offset) {
        break;
      }

      lastMatchingIndex = index;
    }

    return lastMatchingIndex;
  };
}
