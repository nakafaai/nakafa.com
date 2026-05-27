import { GenericId } from "@confect/core";
import { Schema } from "effect";
import type { CacheSnapshot } from "virtua";
import { vi } from "vitest";
import type {
  Forum,
  ForumPost,
} from "@/components/school/classes/forum/conversation/data/entities";

const decodeClassId = Schema.decodeUnknownSync(
  GenericId.GenericId("schoolClasses")
);
const decodeForumId = Schema.decodeUnknownSync(
  GenericId.GenericId("schoolClassForums")
);
const decodePostId = Schema.decodeUnknownSync(
  GenericId.GenericId("schoolClassForumPosts")
);
const decodeSchoolId = Schema.decodeUnknownSync(GenericId.GenericId("schools"));
const decodeUserId = Schema.decodeUnknownSync(GenericId.GenericId("users"));

export const conversationTestForumId = decodeForumId("forum_1");
export const conversationTestOtherForumId = decodeForumId("forum_2");
export const conversationTestPostId = decodePostId("post_1");
export const conversationTestOtherPostId = decodePostId("post_2");

/** Creates one opaque `virtua` cache fixture for tests that only need identity. */
export function createConversationTestCache(): CacheSnapshot {
  return Object.create(null);
}

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
    _id: decodePostId(postId),
    attachments: [],
    body: `post-${sequence}`,
    classId: decodeClassId("class_1"),
    createdBy: decodeUserId("user_1"),
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
    classId: decodeClassId("class_1"),
    createdBy: decodeUserId("user_1"),
    isPinned: false,
    lastPostAt: Date.UTC(2026, 3, 21, 8, 0, 0),
    lastPostBy: decodeUserId("user_1"),
    myReactions: [],
    nextPostSequence: 4,
    postCount: 3,
    reactionCounts: [],
    reactionUsers: [],
    schoolId: decodeSchoolId("school_1"),
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
      cache: createConversationTestCache(),
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
