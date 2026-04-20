import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/lib/store/forum";

/** Represents one mounted transcript window and its current paging boundaries. */
export interface ConversationTimeline {
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
  isAtLatestEdge: boolean;
  isJumpMode: boolean;
  newestPostId: Id<"schoolClassForumPosts"> | null;
  oldestPostId: Id<"schoolClassForumPosts"> | null;
  posts: ForumPost[];
}

/** Creates the reactive live timeline from the latest paginated query window. */
export function createLiveTimeline(
  posts: ForumPost[],
  hasMoreBefore: boolean
): ConversationTimeline {
  return {
    hasMoreAfter: false,
    hasMoreBefore,
    isAtLatestEdge: true,
    isJumpMode: false,
    newestPostId: posts.at(-1)?._id ?? null,
    oldestPostId: posts[0]?._id ?? null,
    posts,
  };
}

/** Replaces matching posts with fresher copies without changing list order. */
export function replaceMatchingPosts(
  current: ForumPost[],
  incoming: ForumPost[]
) {
  if (incoming.length === 0 || current.length === 0) {
    return {
      changed: false,
      posts: current,
    };
  }

  const incomingById = new Map(incoming.map((post) => [post._id, post]));
  let changed = false;
  const posts = current.map((post) => {
    const nextPost = incomingById.get(post._id);

    if (!nextPost || nextPost === post) {
      return post;
    }

    changed = true;
    return nextPost;
  });

  return {
    changed,
    posts,
  };
}

/** Prepends older posts while keeping already loaded ids unique. */
export function prependUniquePosts(
  current: ForumPost[],
  incoming: ForumPost[]
) {
  const nextPosts = replaceMatchingPosts(current, incoming);
  const existingIds = new Set(nextPosts.posts.map((post) => post._id));
  const prepended = incoming.filter((post) => !existingIds.has(post._id));

  if (prepended.length === 0) {
    return nextPosts;
  }

  return {
    changed: true,
    posts: [...prepended, ...nextPosts.posts],
  };
}

/** Appends newer posts while keeping already loaded ids unique. */
export function appendUniquePosts(current: ForumPost[], incoming: ForumPost[]) {
  const nextPosts = replaceMatchingPosts(current, incoming);
  const existingIds = new Set(nextPosts.posts.map((post) => post._id));
  const appended = incoming.filter((post) => !existingIds.has(post._id));

  if (appended.length === 0) {
    return nextPosts;
  }

  return {
    changed: true,
    posts: [...nextPosts.posts, ...appended],
  };
}

/** Keeps a focused timeline fresh when live posts update underneath it. */
export function syncFocusedTimelineWithLivePosts({
  current,
  liveHasMoreBefore,
  livePosts,
}: {
  current: ConversationTimeline;
  liveHasMoreBefore: boolean;
  livePosts: ForumPost[];
}) {
  if (current.posts.length === 0) {
    if (!current.isAtLatestEdge) {
      return current;
    }

    return createLiveTimeline(livePosts, liveHasMoreBefore);
  }

  const nextPosts = current.isAtLatestEdge
    ? appendUniquePosts(current.posts, livePosts)
    : replaceMatchingPosts(current.posts, livePosts);

  if (!nextPosts.changed) {
    return current;
  }

  return {
    ...current,
    hasMoreAfter: current.isAtLatestEdge ? false : current.hasMoreAfter,
    isJumpMode: current.isAtLatestEdge ? false : current.isJumpMode,
    newestPostId: nextPosts.posts.at(-1)?._id ?? null,
    oldestPostId: nextPosts.posts[0]?._id ?? null,
    posts: nextPosts.posts,
  };
}
