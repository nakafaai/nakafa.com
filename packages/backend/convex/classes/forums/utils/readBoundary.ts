import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { DatabaseReader } from "@repo/backend/convex/_generated/server";
import {
  findForumPostIndexAtTimestamp,
  getForumPostsAtTimestamp,
} from "@repo/backend/convex/classes/forums/utils/timestampPosts";

/**
 * Compare two post ids inside one same-timestamp forum slice.
 */
export function isPostAfterBoundaryInTimestamp(
  postsAtTimestamp: Array<{ _id: Id<"schoolClassForumPosts"> }>,
  {
    boundaryPostId,
    postId,
  }: {
    boundaryPostId: Id<"schoolClassForumPosts">;
    postId: Id<"schoolClassForumPosts">;
  }
) {
  const boundaryIndex = findForumPostIndexAtTimestamp(
    postsAtTimestamp,
    boundaryPostId
  );
  const postIndex = findForumPostIndexAtTimestamp(postsAtTimestamp, postId);

  if (postIndex < 0) {
    return false;
  }

  if (boundaryIndex < 0) {
    return true;
  }

  return postIndex > boundaryIndex;
}

/**
 * Annotate one page of forum posts with unread state for the current user.
 */
export async function annotateUnreadForumPosts<
  TPost extends {
    _creationTime: number;
    _id: Id<"schoolClassForumPosts">;
    createdBy: Id<"users">;
  },
>(
  db: DatabaseReader,
  {
    currentUserId,
    forumId,
    posts,
    readState,
  }: {
    currentUserId: Id<"users">;
    forumId: Id<"schoolClassForums">;
    posts: TPost[];
    readState: {
      lastReadAt: number;
      lastReadPostId?: Id<"schoolClassForumPosts">;
    } | null;
  }
) {
  if (!readState) {
    return posts.map((post) => ({
      ...post,
      isUnread: post.createdBy !== currentUserId,
    }));
  }

  const sameTimestampPosts =
    readState.lastReadPostId &&
    posts.some((post) => post._creationTime === readState.lastReadAt)
      ? await getForumPostsAtTimestamp(db, {
          forumId,
          timestamp: readState.lastReadAt,
        })
      : null;

  return posts.map((post) => {
    if (post.createdBy === currentUserId) {
      return { ...post, isUnread: false };
    }

    if (post._creationTime > readState.lastReadAt) {
      return { ...post, isUnread: true };
    }

    if (
      post._creationTime < readState.lastReadAt ||
      !readState.lastReadPostId
    ) {
      return { ...post, isUnread: false };
    }

    if (!sameTimestampPosts) {
      return { ...post, isUnread: false };
    }

    return {
      ...post,
      isUnread: isPostAfterBoundaryInTimestamp(sameTimestampPosts, {
        boundaryPostId: readState.lastReadPostId,
        postId: post._id,
      }),
    };
  });
}

/**
 * Return whether a new read boundary is strictly later than the stored one.
 */
export async function shouldAdvanceForumReadBoundary(
  db: DatabaseReader,
  {
    existingLastReadAt,
    existingLastReadPostId,
    forumId,
    nextLastReadAt,
    nextLastReadPostId,
  }: {
    existingLastReadAt: number;
    existingLastReadPostId?: Id<"schoolClassForumPosts">;
    forumId: Id<"schoolClassForums">;
    nextLastReadAt: number;
    nextLastReadPostId?: Id<"schoolClassForumPosts">;
  }
) {
  if (nextLastReadAt > existingLastReadAt) {
    return true;
  }

  if (nextLastReadAt < existingLastReadAt) {
    return false;
  }

  if (!(nextLastReadPostId && existingLastReadPostId)) {
    return false;
  }

  if (existingLastReadPostId === nextLastReadPostId) {
    return false;
  }

  const postsAtTimestamp = await getForumPostsAtTimestamp(db, {
    forumId,
    timestamp: nextLastReadAt,
  });

  return isPostAfterBoundaryInTimestamp(postsAtTimestamp, {
    boundaryPostId: existingLastReadPostId,
    postId: nextLastReadPostId,
  });
}
