import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { ForumPost } from "@/components/school/classes/forum/conversation/store/forum";

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

export interface OlderPrefetchPage {
  hasMoreBefore: boolean;
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

/** Refreshes already loaded focused posts without changing the frozen history boundaries. */
export function refreshFocusedTimeline({
  current,
  livePosts,
}: {
  current: ConversationTimeline;
  livePosts: ForumPost[];
}) {
  const nextPosts = replaceMatchingPosts(current.posts, livePosts);

  if (!nextPosts.changed) {
    return current;
  }

  return {
    ...current,
    posts: nextPosts.posts,
  };
}

/** Derives buffered older pages that have been fetched but should not be prepended yet. */
export function createOlderPrefetchPages({
  fetchedPosts,
  hasMoreBefore,
  maxPages,
  pageSize,
  renderedPosts,
}: {
  fetchedPosts: ForumPost[];
  hasMoreBefore: boolean;
  maxPages: number;
  pageSize: number;
  renderedPosts: ForumPost[];
}) {
  if (fetchedPosts.length === 0 || renderedPosts.length === 0) {
    return [] satisfies OlderPrefetchPage[];
  }

  const renderedOldestPostId = renderedPosts[0]?._id;
  const oldestRenderedIndex = fetchedPosts.findIndex(
    (post) => post._id === renderedOldestPostId
  );

  if (oldestRenderedIndex <= 0) {
    return [] satisfies OlderPrefetchPage[];
  }

  const bufferedOlderPosts = fetchedPosts.slice(0, oldestRenderedIndex);
  const pages: OlderPrefetchPage[] = [];

  for (
    let startIndex = 0;
    startIndex < bufferedOlderPosts.length;
    startIndex += pageSize
  ) {
    const posts = bufferedOlderPosts.slice(startIndex, startIndex + pageSize);

    if (posts.length === 0) {
      continue;
    }

    pages.push({
      hasMoreBefore,
      oldestPostId: posts[0]?._id ?? null,
      posts,
    });
  }

  return [...pages].reverse().slice(0, maxPages);
}

/** Returns the next older boundary id that should be prefetched into the local queue. */
export function getOlderPrefetchBoundaryPostId({
  bufferedPages,
  renderedPosts,
}: {
  bufferedPages: OlderPrefetchPage[];
  renderedPosts: ForumPost[];
}) {
  const oldestBufferedPage = bufferedPages.at(-1);

  if (oldestBufferedPage?.oldestPostId) {
    return oldestBufferedPage.oldestPostId;
  }

  return renderedPosts[0]?._id ?? null;
}
